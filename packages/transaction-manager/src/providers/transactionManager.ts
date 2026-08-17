import { logger } from '@ens-apps/utils/logger'
import type { Hash, PublicClient } from 'viem'
import { type ActorRefFrom, createActor } from 'xstate'
import {
  archiveTransaction,
  clearAllTransactions,
  type PersistedTransaction,
  removeTransaction,
  saveTransaction,
} from '../helpers/transaction-persistence'
import { transactionMachine } from '../machines/transaction.machine'
import { createRunTelemetryService } from '../services/run-telemetry.service'
import type {
  FailedRunPayloadV2,
  RunTelemetryEventSubscriber,
  RunTelemetrySubscriber,
  TransactionRunEventV2,
  TransactionRunStatus,
} from '../types/audit.types'
import type { Signer } from '../types/signer.types'
import type {
  TransactionIntent,
  TransactionOptions,
  TransactionRequest,
} from '../types/transaction.types'

type TransactionChangeListener = (
  transactions: Map<string, ActorRefFrom<typeof transactionMachine>>,
) => void

/**
 * A transaction that has reached a terminal state, emitted to
 * {@link TransactionManager.onTransactionArchived} subscribers. This is the
 * seam through which an app reports transaction history to a backend (the
 * core package stays transport- and app-agnostic).
 */
export interface ArchivedTransaction {
  txId: string
  chainId?: number
  hash?: Hash
  status: TransactionRunStatus
  /** Caller-supplied operation kind (e.g. 'set-resolver'); see TransactionOptions.operation */
  operation?: string
  /** ENS name involved, for display */
  name?: string
  request?: TransactionRequest
  error?: string
  timestamp: number
}

type TransactionArchivedListener = (transaction: ArchivedTransaction) => void

/**
 * Build the {@link ArchivedTransaction} payload emitted when a transaction
 * reaches a terminal state. Pure (the timestamp is supplied) so the
 * name/request fallback logic is unit-testable in isolation.
 *
 * - `name` prefers the caller-supplied option, falling back to the intent name
 *   for ENS renewals.
 * - `request` prefers the prepared request, falling back to a custom intent's
 *   embedded request.
 */
export function buildArchivedTransaction(input: {
  txId: string
  chainId?: number
  status: TransactionRunStatus
  hash?: Hash
  error?: string
  operation?: string
  name?: string
  intent?: TransactionIntent
  request?: TransactionRequest
  timestamp: number
}): ArchivedTransaction {
  const { intent, name, request } = input
  return {
    txId: input.txId,
    chainId: input.chainId,
    hash: input.hash,
    status: input.status,
    operation: input.operation,
    name: name ?? (intent?.type === 'ens-renewal' ? intent.name : undefined),
    request:
      request || (intent?.type === 'custom' ? intent.request : undefined),
    error: input.error,
    timestamp: input.timestamp,
  }
}

function getRootState(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length > 0 && keys[0]) return keys[0]
  }
  return String(value)
}

function isCancelledState(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const root = (value as Record<string, unknown>).error
  return root === 'cancelled'
}

function generateTransactionId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    return `tx-${Date.now()}-${Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`
  }
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Transaction Manager Singleton
 *
 * SSR-safe module-level singleton that manages transaction actors.
 * Can be called directly without React context.
 *
 * SSR Safety:
 * - PublicClients are stored per-chain (safe to share - no user data)
 * - Supports fallback to per-transaction publicClient if not pre-configured
 * - Safe to use in Next.js, Remix, etc.
 *
 * Benefits:
 * - No prop drilling - import and call directly
 * - Works outside React (Node.js, CLI, tests)
 * - Single source of truth for all transactions
 * - Supports multiple chains simultaneously
 * - Still supports React integration via change listeners
 */
class TransactionManager {
  private transactions = new Map<
    string,
    ActorRefFrom<typeof transactionMachine>
  >()
  private listeners = new Set<TransactionChangeListener>()
  private telemetryListeners = new Set<RunTelemetrySubscriber>()
  private telemetryEventListeners = new Set<RunTelemetryEventSubscriber>()
  private archivedListeners = new Set<TransactionArchivedListener>()
  private publicClients = new Map<number, PublicClient>() // chainId -> PublicClient
  private completedTelemetry = new Set<string>()
  private runTelemetry = createRunTelemetryService()

  /**
   * Set a public client for a specific chain
   *
   * Optional - if set, you don't need to pass publicClient in startTransaction
   * options. Useful for reducing verbosity in single-chain or multi-chain apps.
   */
  setPublicClient(chainId: number, publicClient: PublicClient): void {
    this.publicClients.set(chainId, publicClient)
  }

  /**
   * Get a stored public client for a chain
   */
  getPublicClient(chainId: number): PublicClient | undefined {
    return this.publicClients.get(chainId)
  }

  /**
   * Start a new transaction
   *
   * publicClient can be:
   * 1. Passed in options (takes priority)
   * 2. Pre-configured via setPublicClient() - determined by intent/request chainId or options.chainId
   * 3. If neither, throws an error
   *
   * @returns Transaction ID
   */
  startTransaction(
    intentOrRequest: TransactionIntent | TransactionRequest,
    signer: Signer,
    options: TransactionOptions & {
      publicClient?: PublicClient
      chainId?: number
      useSmartAccount?: boolean
    },
  ): string {
    const {
      publicClient: optionsPublicClient,
      chainId,
      useSmartAccount,
      ...transactionOptions
    } = options

    // Determine if this is an intent or a pre-prepared request
    const isIntent =
      'type' in intentOrRequest &&
      (intentOrRequest.type === 'ens-renewal' ||
        intentOrRequest.type === 'eth-transfer' ||
        intentOrRequest.type === 'custom')

    const intent = isIntent ? (intentOrRequest as TransactionIntent) : undefined
    const request = isIntent
      ? undefined
      : (intentOrRequest as TransactionRequest)

    // Determine which publicClient to use (priority: options > stored > error)
    let publicClient = optionsPublicClient

    if (!publicClient) {
      // Try to get from stored clients using chainId
      const resolvedChainId =
        chainId ||
        request?.chainId ||
        // biome-ignore lint/suspicious/noExplicitAny: runtime duck-typing to extract chainId from intent variants
        (intent as any)?.chainId
      if (resolvedChainId) {
        publicClient = this.publicClients.get(resolvedChainId)
      }
    }

    if (!publicClient) {
      throw new Error(
        'publicClient is required. Either pass it in options or pre-configure it with setPublicClient(chainId, client)',
      )
    }

    const txId = transactionOptions.id || generateTransactionId()

    // Create and start the transaction actor
    const actor = createActor(transactionMachine, {
      input: {
        intent,
        request,
        signer,
        publicClient,
        options: transactionOptions,
        chainId,
        useSmartAccount,
      },
    })

    this.runTelemetry.startRun({
      txId,
      chainId,
      intent,
      request:
        request || (intent?.type === 'custom' ? intent.request : undefined),
      signer,
      options: transactionOptions,
      useSmartAccount: Boolean(useSmartAccount),
    })

    actor.start()

    // Subscribe to actor state changes for persistence + telemetry
    actor.subscribe((snapshot) => {
      const state = getRootState(snapshot.value)
      const ctx = snapshot.context

      // Observability contract — do not remove. The portal registration e2e and
      // the shared console-monitor helper detect transaction progress and
      // terminal success by matching this exact
      // `[TRANSACTION MANAGER] Transaction <id> state: <state>` console line
      // (e.g. `Transaction tx-reg-register state: success`). It is load-bearing
      // for the tests, not stray debug logging.
      console.log(`📊 [TRANSACTION MANAGER] Transaction ${txId} state:`, state)

      const telemetryEvent = this.runTelemetry.recordSnapshot(txId, snapshot)
      if (telemetryEvent) {
        this.notifyTelemetryEventListeners(
          telemetryEvent.runId,
          txId,
          telemetryEvent.event,
        )
      }

      const persisted: PersistedTransaction = {
        id: txId,
        hash: ctx.hash,
        state,
        context: {
          // Prefer the machine-prepared request (ctx.request); the closure
          // `request` is only set for pre-prepared requests, not intents the
          // machine prepares internally (ens-renewal/eth-transfer).
          request: ctx.request ?? request,
          error: ctx.error?.message,
        },
        timestamp: Date.now(),
        updatedAt: Date.now(),
      }

      const isTerminal = state === 'success' || state === 'error'

      if (!isTerminal) {
        // Keep the in-flight record in the active store.
        saveTransaction(txId, persisted).catch((err) =>
          logger.error(`Failed to save transaction ${txId}`, err),
        )
        return
      }

      // Terminal — run the completion side effects exactly once.
      if (this.completedTelemetry.has(txId)) return
      this.completedTelemetry.add(txId)

      const status: TransactionRunStatus =
        state === 'success'
          ? 'success'
          : isCancelledState(snapshot.value)
            ? 'cancelled'
            : 'error'

      // Move the record from the active store to the history store.
      archiveTransaction(persisted).catch((err) =>
        logger.error(`Failed to archive transaction ${txId}`, err),
      )

      // Report the terminal transaction (apps wire this to a backend).
      this.notifyTransactionArchived(
        buildArchivedTransaction({
          txId,
          chainId,
          status,
          hash: ctx.hash,
          error: ctx.error?.message,
          operation: transactionOptions.operation,
          name: transactionOptions.name,
          intent,
          request: ctx.request ?? request,
          timestamp: Date.now(),
        }),
      )

      const payload = this.runTelemetry.completeRun(txId, status)
      if (payload) {
        this.notifyTelemetryListeners(payload)
      }
    })

    // Add to active transactions
    this.transactions.set(txId, actor)
    this.notifyListeners()

    return txId
  }

  /**
   * Cancel a transaction
   */
  cancelTransaction(id: string): void {
    const actor = this.transactions.get(id)
    if (actor) {
      actor.send({ type: 'CANCEL' })
    }

    // Remove from active transactions
    this.transactions.delete(id)
    this.notifyListeners()

    // Remove from persistence
    removeTransaction(id).catch((err) =>
      logger.error(`Failed to remove cancelled transaction ${id}`, err),
    )
  }

  /**
   * Get a specific transaction actor by ID
   */
  getTransaction(
    id: string,
  ): ActorRefFrom<typeof transactionMachine> | undefined {
    return this.transactions.get(id)
  }

  /**
   * Get all active transactions
   */
  getTransactions(): Map<string, ActorRefFrom<typeof transactionMachine>> {
    return new Map(this.transactions)
  }

  /**
   * Subscribe to transaction changes (for React integration)
   *
   * @returns Unsubscribe function
   */
  onTransactionsChange(listener: TransactionChangeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Subscribe to terminal transactions as they are archived.
   *
   * This is the seam an app uses to persist transaction history to a backend
   * (e.g. a user's account), keeping the core package backend-agnostic.
   *
   * @returns Unsubscribe function
   */
  onTransactionArchived(listener: TransactionArchivedListener): () => void {
    this.archivedListeners.add(listener)
    return () => {
      this.archivedListeners.delete(listener)
    }
  }

  onFailedRunTelemetry(listener: RunTelemetrySubscriber): () => void {
    this.telemetryListeners.add(listener)
    return () => {
      this.telemetryListeners.delete(listener)
    }
  }

  onRunTelemetryEvent(listener: RunTelemetryEventSubscriber): () => void {
    this.telemetryEventListeners.add(listener)
    return () => {
      this.telemetryEventListeners.delete(listener)
    }
  }

  /**
   * Notify all listeners of transaction changes
   */
  private notifyListeners(): void {
    const txCopy = this.getTransactions()
    this.listeners.forEach((listener) => {
      listener(txCopy)
    })
  }

  private notifyTransactionArchived(transaction: ArchivedTransaction): void {
    this.archivedListeners.forEach((listener) => {
      try {
        listener(transaction)
      } catch (error) {
        logger.error('Transaction archived listener crashed', error)
      }
    })
  }

  private notifyTelemetryListeners(payload: FailedRunPayloadV2): void {
    this.telemetryListeners.forEach((listener) => {
      try {
        listener(payload)
      } catch (error) {
        logger.error('Failed run telemetry listener crashed', error)
      }
    })
  }

  private notifyTelemetryEventListeners(
    runId: string,
    txId: string,
    event: TransactionRunEventV2,
  ): void {
    this.telemetryEventListeners.forEach((listener) => {
      try {
        listener({
          runId,
          txId,
          status:
            event.phase === 'success'
              ? 'success'
              : event.phase === 'error' && event.substate === 'cancelled'
                ? 'cancelled'
                : event.phase === 'error'
                  ? 'error'
                  : undefined,
          event,
        })
      } catch (error) {
        logger.error('Telemetry event listener crashed', error)
      }
    })
  }

  /**
   * Clear all transactions (for testing)
   */
  clear(): void {
    this.transactions.forEach((actor) => {
      actor.stop()
    })
    this.transactions.clear()
    this.completedTelemetry.clear()
    this.runTelemetry.clear()
    this.notifyListeners()
  }

  /**
   * Cancel and clear all active transactions and persistence
   */
  async clearAllAndPersistence(): Promise<void> {
    this.transactions.forEach((actor) => {
      actor.send({ type: 'CANCEL' })
      actor.stop()
    })

    this.transactions.clear()
    this.completedTelemetry.clear()
    this.runTelemetry.clear()
    this.notifyListeners()

    try {
      await clearAllTransactions()
    } catch (err) {
      logger.error('Failed to clear persisted transactions', err)
    }
  }
}

// Export singleton instance
export const transactionManager = new TransactionManager()
