/**
 * Warp Transport Actor
 *
 * Submits transactions via Rhinestone Warp (intent-based, NOT ERC-4337).
 *
 * Flow: User → Orchestrator → Relayer Market → Intent Router → Account
 *
 * Unlike an ERC-4337 bundler path:
 * - No bundler/paymaster needed — relayers handle this
 * - Intent-based execution rather than UserOps
 * - Built-in cross-chain support
 * - Uses `waitForExecution` to get the fill receipt
 */

import { logger } from '@ens-apps/utils/logger'
import type { TokenRequest, Transaction } from '@rhinestone/sdk'
import { errAsync, fromPromise, type ResultAsync } from 'neverthrow'
import type { Hash } from 'viem'
import { sepolia } from 'viem/chains'
import {
  extractOrchestratorErrorContext,
  TransactionSubmissionError,
} from '../errors/transaction.errors'
import type { RhinestoneSigner } from '../types/signer.types'
import type { TransactionRequest } from '../types/transaction.types'

/**
 * The ONLY sponsorship value this codebase ever sends.
 *
 * Gas sponsorship does not exist on the standalone-HCA deployment: intents are
 * user-paid in USDC out of the HCA's own balance, funded by an EIP-2612 permit
 * carried inside the batch. There is deliberately no caller-facing knob and no
 * env flag — this used to default to `true` when `sponsored` was omitted, so
 * every new call site silently asked for a subsidy no relayer here offers.
 */
const UNSPONSORED = { gas: false, bridging: false, swaps: false } as const

/** Fee asset the HCA pays from when a request does not name one. */
const DEFAULT_FEE_ASSET = 'USDC' as const

export interface SubmitWarpTransactionInput {
  readonly request: TransactionRequest
  readonly signer: RhinestoneSigner
}

export function submitWarpTransaction(
  input: SubmitWarpTransactionInput,
): ResultAsync<Hash, TransactionSubmissionError> {
  const { request, signer } = input
  const { account, config } = signer

  if (request.type !== 'rhinestone-intent') {
    return errAsync(
      new TransactionSubmissionError(
        request,
        new Error(
          `Warp transport requires rhinestone-intent request, got: ${request.type}`,
        ),
      ),
    )
  }

  const { calls, feeAsset, sessionEnableData, tokenRequests, auxiliaryFunds } =
    request.rhinestoneParams

  if (sessionEnableData && !signer.session) {
    return errAsync(
      new TransactionSubmissionError(
        request,
        new Error(
          'rhinestoneParams.sessionEnableData requires a signer with an active session',
        ),
      ),
    )
  }

  if (!calls || calls.length === 0) {
    return errAsync(
      new TransactionSubmissionError(
        request,
        new Error('rhinestoneParams.calls is required and must not be empty'),
      ),
    )
  }

  // Runtime guard: ensure we have a RhinestoneAccount.
  // The waitForExecution method only exists on RhinestoneAccount.
  if (typeof account.waitForExecution !== 'function') {
    return errAsync(
      new TransactionSubmissionError(
        request,
        new Error(
          'Warp transport requires a RhinestoneAccount but received a different client type. ' +
            'Check that the Rhinestone HCA provider is active.',
        ),
      ),
    )
  }

  const nowMs = (): number =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()

  const overallStart = nowMs()

  // Authorization: if the signer carries an active scoped session, the SDK
  // signs this Intent with the ephemeral SESSION KEY (no wallet prompt) via
  // `experimental_session`. `enableData` is attached ONLY on the request that
  // also carries the on-chain `enableSessionWithRefund` call (the first HCA
  // action); afterwards it is omitted per the standalone-HCA spec. Without a
  // session we omit `signers` and the SDK uses the connected owner
  // (owner-signed).
  const sessionSigners = signer.session
    ? ({
        type: 'experimental_session' as const,
        session: signer.session.session,
        ...(sessionEnableData ? { enableData: sessionEnableData } : {}),
        verifyExecutions: true,
      } satisfies NonNullable<Transaction['signers']>)
    : undefined

  // Funds arriving DURING this intent (the HCA's `permit` + `transferFrom`
  // pair). The planner only credits balances it can already see, so without
  // this it refuses to quote whenever the account's standing balance is below
  // the fee.
  const declaredFunds = auxiliaryFunds as Transaction['auxiliaryFunds']

  return fromPromise(
    (async () => {
      const chain = config.chain || sepolia

      const sendStart = nowMs()

      // Log raw call data before SDK processes it
      logger.debug(
        '📤 [WARP] Raw calls before SDK:',
        JSON.stringify(
          calls,
          (_, v) => (typeof v === 'bigint' ? v.toString() : v),
          2,
        ),
      )
      logger.debug('📤 [WARP] Account address:', account.getAddress?.())
      logger.debug('📤 [WARP] Chain:', chain.name, chain.id)

      const sdkParams = {
        sourceChains: [chain],
        targetChain: chain,
        // Spread into a fresh mutable array: the SDK's CallInput[] is mutable
        // while rhinestoneParams.calls is readonly.
        calls: [...calls],
        // Always user-paid; see UNSPONSORED above.
        sponsored: UNSPONSORED,
        feeAsset: feeAsset ?? DEFAULT_FEE_ASSET,
        // Pass through caller-provided tokenRequests (for cross-chain txs).
        // Defaults to [] which skips balance validation (needed for local mockestrator).
        // Cast needed: SDK's internal TokenRequests is a strict discriminated union
        // not assignable from TokenRequest[], but semantically equivalent here.
        tokenRequests: (tokenRequests ?? []) as TokenRequest[] &
          Transaction['tokenRequests'],
        ...(declaredFunds ? { auxiliaryFunds: declaredFunds } : {}),
        ...(sessionSigners ? { signers: sessionSigners } : {}),
      } satisfies Transaction

      logger.debug(
        '📤 [WARP] SDK sendTransaction params:',
        JSON.stringify(
          Object.fromEntries(
            Object.entries(sdkParams).map(([k, v]) => [
              k,
              Array.isArray(v)
                ? `Array(${(v as unknown[]).length})`
                : typeof v === 'object'
                  ? `${(v as { name?: string })?.name ?? typeof v}`
                  : v,
            ]),
          ),
        ),
      )

      const transaction = await account.sendTransaction(sdkParams)
      const sendLatencyMs = nowMs() - sendStart

      // The orchestrator's intent id — the handle for
      // `GET /intent-operation/{id}`, and the only thing that lets Rhinestone
      // look a specific intent up. Deliberately NOT `logger.debug`/`info`,
      // which are gated on `isDev` and so never reach a deployed build; an
      // identifier is worthless if it only exists on a developer's machine.
      // Printed as a decimal string because it is a bigint and JSON/console
      // formatting of one is inconsistent.
      const intentId =
        (transaction as { id?: bigint } | undefined)?.id?.toString() ??
        'unknown'
      // NOTE: no `gasLimit` to report — submitted intents deliberately carry
      // none, so the ceiling on a filled intent is the orchestrator's own
      // estimate, not something this app sets. (`gasLimit` is passed only to
      // `prepareTransaction` when quoting, to size the funding permit.)
      console.log('🧾 [WARP] intent submitted:', {
        intentId,
        chainId: chain.id,
        account: account.getAddress?.(),
        calls: calls.length,
      })

      logger.debug(
        '📤 [WARP] sendTransaction latency (ms):',
        sendLatencyMs.toFixed(1),
      )

      // Wait for a relayer to fill the intent
      const waitStart = nowMs()
      const receipt = await account.waitForExecution(transaction, false)
      const waitLatencyMs = nowMs() - waitStart
      const totalLatencyMs = nowMs() - overallStart

      logger.debug(
        '📥 [WARP] waitForExecution latency (ms):',
        waitLatencyMs.toFixed(1),
      )
      logger.debug(
        '✅ [WARP] Total submission latency (ms):',
        totalLatencyMs.toFixed(1),
      )

      const txHash = receipt.fill.hash

      // Pair the intent id with the fill hash in ONE line, so a gas or
      // latency report can be handed over without cross-referencing two logs.
      console.log('🧾 [WARP] intent filled:', {
        intentId,
        fillHash: txHash,
        chainId: chain.id,
        totalLatencyMs: Math.round(totalLatencyMs),
      })

      if (!txHash) {
        throw new Error('No transaction hash returned from Warp execution')
      }

      return txHash
    })(),
    (error: unknown) => {
      // Surface full orchestrator error context. The Rhinestone SDK
      // throws `SimulationFailedError` / `OrchestratorError` instances
      // that carry `context`, `errorType`, `traceId`, `statusCode`,
      // `simulations` as enumerable properties — none of which show up
      // in the default `Error.message` and none of which survive a
      // structured-clone round-trip via `postMessage` or react devtools'
      // collapsed-object preview.
      //
      // Three things are done here so the next 400 is debuggable:
      //   1. Pretty-print the orchestrator fields (bigint-safe) to the
      //      logger so they're in the dev console regardless of how the
      //      logger sink formats objects.
      //   2. Pass the original `error` as the cause; the
      //      `TransactionSubmissionError` constructor now lifts the
      //      orchestrator fields onto `error.orchestrator` AND inlines
      //      a one-line summary into `error.message`, so the rich
      //      context propagates through XState's error event without
      //      consumers having to re-parse the cause.
      const orchestrator = extractOrchestratorErrorContext(error)
      const message = error instanceof Error ? error.message : String(error)
      try {
        logger.error(
          '🛑 [WARP] Orchestrator error detail:',
          JSON.stringify(
            { message, ...orchestrator },
            (_, v) => (typeof v === 'bigint' ? v.toString() : v),
            2,
          ),
        )
      } catch {
        logger.error(
          '🛑 [WARP] Orchestrator error (unserializable):',
          message,
          orchestrator,
        )
      }
      return new TransactionSubmissionError(request, error as Error)
    },
  )
}
