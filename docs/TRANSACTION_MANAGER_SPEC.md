# Transaction Manager Library Specification

## Executive Summary

The Transaction Manager is a shared library for the ENS apps monorepo that provides a unified, robust system for handling blockchain transactions across multiple chains, transaction types, and complex multi-step user flows. It addresses critical issues identified in production, including transaction detection failures, complex flow management, and the need for better state persistence and error handling.

## Core Requirements

### 1. Transaction Type Support

The Transaction Manager must handle:
- **EOA transactions on L1 (Ethereum Mainnet)**
- **L2 transactions (Optimism, Base, etc.)**
- **ERC-4337 Account Abstraction transactions**
- **Rhinestone Module intents**
- **Private mempool transactions** (e.g., Flashbots Protect)

### 2. Multi-Step Flow Management

The system must orchestrate complex user flows involving multiple transactions:
- **Name Registration**: Commit → Wait → Reveal → Set Records
- **Cross-chain Operations**: Register on L2 → Bridge to L1 → Set Records
- **Batch Operations**: Multiple name renewals, bulk record updates

### 3. State Persistence & Recovery

All transaction and flow states must be:
- **Persisted locally** (localStorage/IndexedDB)
- **Recoverable after page refresh**
- **Resilient to browser crashes**
- **Cleanable after successful completion or expiry**

### 4. Error Handling & Recovery

Comprehensive error handling using `neverthrow`:
- **Transaction failures** (revert, timeout, insufficient funds)
- **Network issues** (RPC failures, chain switching)
- **User cancellations**
- **Smart recovery strategies** (eth_call fallback for commit detection)

## Architecture

### Core Technologies

- **XState v5**: State machine orchestration
- **neverthrow**: Functional error handling
- **Wagmi v2 + Viem v2**: Ethereum interactions
- **TanStack Query v5**: Server state & caching
- **TypeScript**: Full type safety

### Component Structure

```
@ens-apps/transaction-manager/
├── machines/
│   ├── transaction.machine.ts      # Base transaction state machine
│   ├── flow.machine.ts            # Multi-step flow orchestrator
│   └── persistence.actor.ts       # Storage persistence actor
├── services/
│   ├── transaction.service.ts     # Transaction execution service
│   ├── monitoring.service.ts      # Transaction monitoring & eth_call fallback
│   ├── gas.service.ts             # Gas estimation & optimization
│   ├── intent.service.ts          # Rhinestone intent handling
│   └── audit-trail.service.ts     # Audit trail & debugging service
├── errors/
│   ├── transaction.errors.ts      # Transaction-specific errors
│   └── flow.errors.ts             # Flow-specific errors
├── types/
│   ├── transaction.types.ts       # Core transaction types
│   ├── flow.types.ts              # Flow definition types
│   ├── storage.types.ts           # Persistence types
│   └── audit.types.ts             # Audit trail types
├── hooks/
│   ├── useTransaction.ts          # React hook for single transactions
│   ├── useTransactionFlow.ts      # React hook for multi-step flows
│   ├── useTransactionHistory.ts   # React hook for transaction history
│   └── useAuditTrail.ts          # React hook for audit trail access
└── utils/
    ├── eth-call-fallback.ts      # eth_call detection utilities
    ├── chain-utils.ts             # Multi-chain utilities
    └── debug-utils.ts             # Debugging and diagnostics utilities
```

## Detailed Design

### 1. Base Transaction Machine

```typescript
import { setup, assign, fromPromise } from 'xstate'
import { ResultAsync, ok, err } from 'neverthrow'

export const transactionMachine = setup({
  types: {
    context: {} as {
      request: TransactionRequest
      hash?: Hash
      receipt?: TransactionReceipt
      error?: TransactionError
      retryCount: number
      fallbackChecks: number
    },
    input: {} as {
      request: TransactionRequest
      options?: TransactionOptions
    }
  },
  actors: {
    sendTransaction: fromPromise(/* ... */),
    waitForReceipt: fromPromise(/* ... */),
    checkWithEthCall: fromPromise(/* ... */),
    persistState: fromPromise(/* ... */)
  }
}).createMachine({
  id: 'transaction',
  initial: 'preparing',
  context: ({ input }) => ({
    request: input.request,
    retryCount: 0,
    fallbackChecks: 0
  }),
  states: {
    preparing: {
      invoke: {
        src: 'estimateGas',
        onDone: 'submitting',
        onError: 'error.gasEstimation'
      }
    },
    submitting: {
      invoke: {
        src: 'sendTransaction',
        onDone: {
          target: 'pending',
          actions: assign({ hash: ({ event }) => event.output })
        },
        onError: [
          {
            guard: 'canRetry',
            target: 'retrying'
          },
          {
            target: 'error.submission'
          }
        ]
      }
    },
    pending: {
      invoke: [
        {
          src: 'waitForReceipt',
          onDone: 'confirming',
          onError: 'checkingFallback'
        },
        {
          src: 'persistState',
          // Persistence runs in parallel
        }
      ]
    },
    checkingFallback: {
      // Critical: Use eth_call to check if transaction would succeed
      // This handles cases where commit transactions aren't detected
      invoke: {
        src: 'checkWithEthCall',
        onDone: [
          {
            guard: 'wouldSucceed',
            target: 'success',
            actions: assign({
              receipt: ({ event }) => event.output.simulatedReceipt
            })
          },
          {
            target: 'pending',
            actions: assign({
              fallbackChecks: ({ context }) => context.fallbackChecks + 1
            })
          }
        ]
      }
    },
    confirming: {
      // Wait for additional confirmations if required
      after: {
        CONFIRMATION_DELAY: 'success'
      }
    },
    retrying: {
      after: {
        RETRY_DELAY: 'submitting'
      }
    },
    success: {
      type: 'final',
      entry: 'cleanupPersistence'
    },
    error: {
      states: {
        gasEstimation: {},
        submission: {},
        timeout: {},
        reverted: {}
      }
    }
  }
})
```

### 2. Flow Orchestrator Machine

```typescript
export const flowMachine = setup({
  types: {
    context: {} as {
      flowId: string
      flowType: FlowType
      currentStep: number
      steps: FlowStep[]
      results: TransactionResult[]
      metadata: Record<string, unknown>
    }
  }
}).createMachine({
  id: 'flow',
  initial: 'loadingState',
  states: {
    loadingState: {
      // Restore from persistence if exists
      invoke: {
        src: 'loadPersistedFlow',
        onDone: [
          {
            guard: 'hasPersistedState',
            target: 'resuming'
          },
          {
            target: 'ready'
          }
        ]
      }
    },
    ready: {
      on: {
        START: 'executing'
      }
    },
    resuming: {
      // Determine where to resume based on persisted state
      always: [
        {
          guard: 'allStepsComplete',
          target: 'completed'
        },
        {
          target: 'executing'
        }
      ]
    },
    executing: {
      invoke: {
        src: 'executeCurrentStep',
        onDone: [
          {
            guard: 'hasMoreSteps',
            target: 'executing',
            actions: 'incrementStep'
          },
          {
            target: 'completed'
          }
        ],
        onError: 'error'
      }
    },
    error: {
      on: {
        RETRY: 'executing',
        SKIP_STEP: {
          target: 'executing',
          actions: 'incrementStep'
        },
        CANCEL: 'cancelled'
      }
    },
    completed: {
      type: 'final',
      entry: 'cleanupPersistence'
    },
    cancelled: {
      type: 'final'
    }
  }
})
```

### 3. Transaction Service Layer

```typescript
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'

export class TransactionSubmissionError extends TaggedError('TransactionSubmissionError')<{
  cause: unknown
  request: TransactionRequest
}> {}

export class EthCallFallbackError extends TaggedError('EthCallFallbackError')<{
  cause: unknown
}> {}

export const submitTransaction = ResultFn(async function* ({
  request,
  client,
  options = {}
}: SubmitTransactionParams) {
  // Handle different transaction types
  if (options.usePrivateMempool) {
    return yield* submitToPrivateMempool(request)
  }

  if (request.type === 'erc4337') {
    return yield* submitUserOperation(request)
  }

  if (request.type === 'rhinestone-intent') {
    return yield* submitIntent(request)
  }

  // Standard transaction
  const hash = yield* await fromPromise(
    client.sendTransaction(request),
    (error) => new TransactionSubmissionError({ cause: error, request })
  )

  return ok({ hash })
})

export const checkTransactionWithEthCall = ResultFn(async function* ({
  request,
  client
}: EthCallCheckParams) {
  // Simulate transaction to check if it would succeed
  // This is critical for detecting completed commit transactions
  const result = yield* await fromPromise(
    client.call({
      account: request.from,
      to: request.to,
      data: request.data,
      value: request.value
    }),
    (error) => new EthCallFallbackError({ cause: error })
  )

  // Check if the call would revert (indicating commit already done)
  if (result.includes('0x')) {
    return ok({ wouldSucceed: true, simulatedResult: result })
  }

  return ok({ wouldSucceed: false })
})
```

### 4. Flow Definitions

```typescript
export interface FlowStep {
  id: string
  type: 'transaction' | 'wait' | 'user-action' | 'external-check'
  transaction?: TransactionRequest
  validation?: () => ResultAsync<boolean, ValidationError>
  metadata?: Record<string, unknown>
}

export interface FlowDefinition {
  id: string
  name: string
  steps: FlowStep[]
  onStepComplete?: (step: FlowStep, result: TransactionResult) => void
  onFlowComplete?: (results: TransactionResult[]) => void
}

// Example: Name Registration Flow
export const nameRegistrationFlow: FlowDefinition = {
  id: 'name-registration',
  name: 'Register ENS Name',
  steps: [
    {
      id: 'commit',
      type: 'transaction',
      transaction: {
        to: ENS_REGISTRAR_ADDRESS,
        data: encodeCommit(/* ... */)
      }
    },
    {
      id: 'wait-period',
      type: 'wait',
      metadata: { duration: 60000 } // 60 seconds
    },
    {
      id: 'register',
      type: 'transaction',
      transaction: {
        to: ENS_REGISTRAR_ADDRESS,
        data: encodeRegister(/* ... */)
      },
      validation: async () => {
        // Check if commit period has passed
        return checkCommitReady()
      }
    },
    {
      id: 'set-records',
      type: 'transaction',
      transaction: {
        to: ENS_RESOLVER_ADDRESS,
        data: encodeSetRecords(/* ... */)
      }
    }
  ]
}
```

### 5. React Hooks API

```typescript
// Single transaction hook
export function useTransaction() {
  const [state, send, actor] = useActor(transactionMachine)

  const execute = useCallback((request: TransactionRequest, options?: TransactionOptions) => {
    send({ type: 'EXECUTE', request, options })
  }, [send])

  const retry = useCallback(() => {
    send({ type: 'RETRY' })
  }, [send])

  return {
    state: state.value,
    hash: state.context.hash,
    receipt: state.context.receipt,
    error: state.context.error,
    execute,
    retry,
    isLoading: state.matches('submitting') || state.matches('pending'),
    isSuccess: state.matches('success'),
    isError: state.matches('error')
  }
}

// Multi-step flow hook
export function useTransactionFlow(flowDefinition: FlowDefinition) {
  const [state, send, actor] = useActor(flowMachine, {
    input: { flowDefinition }
  })

  const start = useCallback(() => {
    send({ type: 'START' })
  }, [send])

  const retry = useCallback(() => {
    send({ type: 'RETRY' })
  }, [send])

  const skipStep = useCallback(() => {
    send({ type: 'SKIP_STEP' })
  }, [send])

  const cancel = useCallback(() => {
    send({ type: 'CANCEL' })
  }, [send])

  return {
    currentStep: state.context.steps[state.context.currentStep],
    progress: {
      current: state.context.currentStep,
      total: state.context.steps.length,
      percentage: (state.context.currentStep / state.context.steps.length) * 100
    },
    results: state.context.results,
    start,
    retry,
    skipStep,
    cancel,
    isExecuting: state.matches('executing'),
    isComplete: state.matches('completed'),
    hasError: state.matches('error')
  }
}

// Transaction history hook
export function useTransactionHistory() {
  const { data: history } = useQuery({
    queryKey: ['transaction-history'],
    queryFn: () => loadTransactionHistory(),
    refetchInterval: 5000 // Poll for updates
  })

  const clearHistory = useMutation({
    mutationFn: () => clearTransactionHistory()
  })

  return {
    history,
    clearHistory: clearHistory.mutate,
    pendingTransactions: history?.filter(tx => tx.status === 'pending'),
    failedTransactions: history?.filter(tx => tx.status === 'failed')
  }
}
```

### 6. Persistence Layer

```typescript
interface PersistedTransaction {
  id: string
  hash?: Hash
  request: TransactionRequest
  status: 'pending' | 'success' | 'failed'
  timestamp: number
  chainId: number
  flowId?: string
}

interface PersistedFlow {
  id: string
  type: string
  currentStep: number
  results: TransactionResult[]
  metadata: Record<string, unknown>
  timestamp: number
}

export class TransactionPersistence {
  private readonly STORAGE_KEY = '@ens/transactions'
  private readonly FLOW_KEY = '@ens/flows'
  private readonly MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days

  async saveTransaction(tx: PersistedTransaction): ResultAsync<void, PersistenceError> {
    return ResultAsync.fromPromise(
      this.storage.setItem(`${this.STORAGE_KEY}:${tx.id}`, tx),
      (error) => new PersistenceError({ cause: error })
    )
  }

  async saveFlow(flow: PersistedFlow): ResultAsync<void, PersistenceError> {
    return ResultAsync.fromPromise(
      this.storage.setItem(`${this.FLOW_KEY}:${flow.id}`, flow),
      (error) => new PersistenceError({ cause: error })
    )
  }

  async loadPendingTransactions(): ResultAsync<PersistedTransaction[], PersistenceError> {
    const now = Date.now()
    const transactions = await this.getAllTransactions()

    return ok(
      transactions
        .filter(tx => tx.status === 'pending')
        .filter(tx => now - tx.timestamp < this.MAX_AGE)
    )
  }

  async cleanupOldTransactions(): ResultAsync<void, PersistenceError> {
    const now = Date.now()
    const transactions = await this.getAllTransactions()

    const toDelete = transactions
      .filter(tx => now - tx.timestamp > this.MAX_AGE)
      .map(tx => `${this.STORAGE_KEY}:${tx.id}`)

    return ResultAsync.combine(
      toDelete.map(key => this.storage.removeItem(key))
    ).map(() => undefined)
  }
}
```

### 7. Audit Trail & Debugging System

```typescript
interface StateTransition {
  id: string
  timestamp: number
  machineId: string
  fromState: string
  toState: string
  event: string
  context: Record<string, unknown>
  error?: Error
  metadata?: {
    userId?: string
    sessionId?: string
    chainId?: number
    transactionHash?: string
  }
}

interface AuditEntry {
  transitionId: string
  timestamp: number
  level: 'info' | 'warning' | 'error' | 'critical'
  message: string
  details: Record<string, unknown>
  stackTrace?: string
}

export class AuditTrailService {
  private readonly MAX_TRANSITIONS = 1000 // Store last 1000 transitions
  private readonly MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours
  private readonly STORAGE_KEY = '@ens/audit-trail'
  private transitions: StateTransition[] = []
  private auditLog: AuditEntry[] = []

  constructor(
    private readonly storage: Storage = localStorage,
    private readonly enableRemoteLogging = false
  ) {
    this.loadFromStorage()
    this.setupCleanupInterval()
  }

  // Record state machine transitions
  recordTransition(transition: Omit<StateTransition, 'id' | 'timestamp'>): void {
    const entry: StateTransition = {
      ...transition,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    }

    this.transitions.push(entry)

    // Maintain size limit
    if (this.transitions.length > this.MAX_TRANSITIONS) {
      this.transitions.shift()
    }

    // Persist to storage
    this.saveToStorage()

    // Send to remote logging if enabled
    if (this.enableRemoteLogging && this.shouldLogRemotely(entry)) {
      this.logToRemote(entry)
    }
  }

  // Add audit log entry
  addAuditEntry(
    level: AuditEntry['level'],
    message: string,
    details: Record<string, unknown>
  ): void {
    const entry: AuditEntry = {
      transitionId: this.transitions[this.transitions.length - 1]?.id || 'unknown',
      timestamp: Date.now(),
      level,
      message,
      details,
      stackTrace: level === 'error' || level === 'critical'
        ? new Error().stack
        : undefined
    }

    this.auditLog.push(entry)

    // Log critical errors immediately
    if (level === 'critical') {
      console.error('[CRITICAL]', message, details)
      this.logToRemote(entry)
    }
  }

  // Get transition history for debugging
  getTransitionHistory(filters?: {
    machineId?: string
    fromTime?: number
    toTime?: number
    includeErrors?: boolean
  }): StateTransition[] {
    let history = [...this.transitions]

    if (filters?.machineId) {
      history = history.filter(t => t.machineId === filters.machineId)
    }

    if (filters?.fromTime) {
      history = history.filter(t => t.timestamp >= filters.fromTime)
    }

    if (filters?.toTime) {
      history = history.filter(t => t.timestamp <= filters.toTime)
    }

    if (filters?.includeErrors === false) {
      history = history.filter(t => !t.error)
    }

    return history
  }

  // Generate debug report
  generateDebugReport(transactionId?: string): DebugReport {
    const relevantTransitions = transactionId
      ? this.transitions.filter(t =>
          t.metadata?.transactionHash === transactionId ||
          t.context.transactionId === transactionId
        )
      : this.transitions.slice(-50) // Last 50 transitions

    const relevantAuditLog = transactionId
      ? this.auditLog.filter(entry =>
          relevantTransitions.some(t => t.id === entry.transitionId)
        )
      : this.auditLog.slice(-100) // Last 100 audit entries

    return {
      generatedAt: Date.now(),
      systemInfo: {
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        localStorage: this.getStorageInfo(),
        sessionId: this.getSessionId()
      },
      transitions: relevantTransitions,
      auditLog: relevantAuditLog,
      errorSummary: this.generateErrorSummary(relevantTransitions),
      stateDistribution: this.calculateStateDistribution(relevantTransitions),
      performanceMetrics: this.calculatePerformanceMetrics(relevantTransitions)
    }
  }

  // Export for debugging
  exportToJson(): string {
    return JSON.stringify({
      transitions: this.transitions,
      auditLog: this.auditLog,
      exported: Date.now()
    }, null, 2)
  }

  // Import debug data
  importFromJson(json: string): ResultAsync<void, ImportError> {
    try {
      const data = JSON.parse(json)
      this.transitions = data.transitions || []
      this.auditLog = data.auditLog || []
      this.saveToStorage()
      return ok(undefined)
    } catch (error) {
      return err(new ImportError({ cause: error }))
    }
  }

  private calculateStateDistribution(transitions: StateTransition[]): Record<string, number> {
    return transitions.reduce((acc, t) => {
      acc[t.toState] = (acc[t.toState] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  private calculatePerformanceMetrics(transitions: StateTransition[]): PerformanceMetrics {
    const durations: number[] = []

    for (let i = 1; i < transitions.length; i++) {
      durations.push(transitions[i].timestamp - transitions[i - 1].timestamp)
    }

    return {
      avgTransitionTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxTransitionTime: Math.max(...durations),
      minTransitionTime: Math.min(...durations),
      totalTransitions: transitions.length
    }
  }

  private generateErrorSummary(transitions: StateTransition[]): ErrorSummary {
    const errors = transitions.filter(t => t.error)
    const errorTypes = errors.reduce((acc, t) => {
      const errorType = t.error?.name || 'Unknown'
      acc[errorType] = (acc[errorType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalErrors: errors.length,
      errorRate: (errors.length / transitions.length) * 100,
      errorTypes,
      lastError: errors[errors.length - 1]?.error
    }
  }

  private setupCleanupInterval(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.MAX_AGE
      this.transitions = this.transitions.filter(t => t.timestamp > cutoff)
      this.auditLog = this.auditLog.filter(e => e.timestamp > cutoff)
      this.saveToStorage()
    }, 60 * 60 * 1000) // Cleanup every hour
  }

  private saveToStorage(): void {
    try {
      this.storage.setItem(this.STORAGE_KEY, JSON.stringify({
        transitions: this.transitions,
        auditLog: this.auditLog
      }))
    } catch (error) {
      console.error('Failed to save audit trail:', error)
    }
  }

  private loadFromStorage(): void {
    try {
      const data = this.storage.getItem(this.STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.transitions = parsed.transitions || []
        this.auditLog = parsed.auditLog || []
      }
    } catch (error) {
      console.error('Failed to load audit trail:', error)
    }
  }

  private shouldLogRemotely(entry: StateTransition | AuditEntry): boolean {
    // Log errors and critical events remotely
    return !!(
      'error' in entry && entry.error ||
      'level' in entry && (entry.level === 'error' || entry.level === 'critical')
    )
  }

  private async logToRemote(entry: StateTransition | AuditEntry): Promise<void> {
    // Send to monitoring service (e.g., Sentry, DataDog)
    try {
      await fetch('/api/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      })
    } catch (error) {
      console.error('Failed to send audit log to remote:', error)
    }
  }
}

// Integration with XState machines
export function withAuditTrail<T extends AnyStateMachine>(
  machine: T,
  auditService: AuditTrailService
): T {
  return machine.withConfig({
    actions: {
      ...machine.config.actions,
      // Add audit logging to all transitions
      '*': (context, event, meta) => {
        auditService.recordTransition({
          machineId: machine.id,
          fromState: meta.state.value as string,
          toState: meta.state.value as string,
          event: event.type,
          context: context as Record<string, unknown>,
          metadata: {
            sessionId: getSessionId(),
            chainId: context.chainId,
            transactionHash: context.hash
          }
        })
      }
    }
  }) as T
}

// React hook for accessing audit trail
export function useAuditTrail() {
  const [auditService] = useState(() => new AuditTrailService())

  const getDebugReport = useCallback((transactionId?: string) => {
    return auditService.generateDebugReport(transactionId)
  }, [auditService])

  const exportAudit = useCallback(() => {
    const json = auditService.exportToJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ens-audit-trail-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [auditService])

  const addEntry = useCallback((
    level: 'info' | 'warning' | 'error' | 'critical',
    message: string,
    details: Record<string, unknown>
  ) => {
    auditService.addAuditEntry(level, message, details)
  }, [auditService])

  return {
    getDebugReport,
    exportAudit,
    addEntry,
    getTransitionHistory: auditService.getTransitionHistory.bind(auditService)
  }
}
```

### 8. Gas Optimization Service

```typescript
export const gasOptimizationService = ResultFn(async function* ({
  request,
  client,
  strategy = 'balanced'
}: GasOptimizationParams) {
  // Get current gas prices
  const gasPrices = yield* await fromPromise(
    client.getGasPrice(),
    (error) => new GasEstimationError({ cause: error })
  )

  // Estimate gas limit
  const gasEstimate = yield* await fromPromise(
    client.estimateGas(request),
    (error) => new GasEstimationError({ cause: error })
  )

  // Apply strategy
  const optimizedGas = applyGasStrategy({
    estimate: gasEstimate,
    prices: gasPrices,
    strategy
  })

  // Check for EIP-1559 support
  if (client.chain.fees?.eip1559) {
    const { maxFeePerGas, maxPriorityFeePerGas } = yield* calculateEIP1559Fees(client)

    return ok({
      ...request,
      gas: optimizedGas.limit,
      maxFeePerGas,
      maxPriorityFeePerGas
    })
  }

  return ok({
    ...request,
    gas: optimizedGas.limit,
    gasPrice: optimizedGas.price
  })
})
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Set up package structure in monorepo
- [ ] Implement base transaction machine
- [ ] Create persistence layer
- [ ] Add neverthrow error types
- [ ] Implement audit trail service

### Phase 2: Multi-Step Flows (Week 3)
- [ ] Implement flow orchestrator machine
- [ ] Create flow definition system
- [ ] Add flow persistence
- [ ] Build flow validation system
- [ ] Integrate audit trail with flow machine

### Phase 3: Advanced Features (Week 4)
- [ ] Add eth_call fallback mechanism
- [ ] Implement gas optimization service
- [ ] Add private mempool support
- [ ] Create monitoring service
- [ ] Add debug report generation

### Phase 4: Integration (Week 5)
- [ ] Create React hooks
- [ ] Build example flows (registration, renewal)
- [ ] Integrate with existing apps
- [ ] Add comprehensive tests
- [ ] Implement audit trail UI components

### Phase 5: Special Transaction Types (Week 6)
- [ ] Add ERC-4337 support
- [ ] Implement Rhinestone intent handling
- [ ] Add L2 transaction support
- [ ] Create chain switching logic
- [ ] Add transaction type-specific audit logging

## Testing Strategy

### Unit Tests
- State machine transitions
- Service layer functions
- Error handling paths
- Persistence operations

### Integration Tests
- Full flow execution
- Recovery from persistence
- Multi-chain operations
- Error recovery scenarios

### E2E Tests
- Complete user flows
- Browser refresh recovery
- Network failure handling
- Gas spike scenarios

## Migration Strategy

1. **Gradual Adoption**: New features use Transaction Manager, existing code migrated incrementally
2. **Backwards Compatibility**: Maintain compatibility with existing wagmi patterns
3. **Feature Flags**: Roll out behind feature flags for testing
4. **Monitoring**: Comprehensive logging and error tracking

## Success Metrics

- **Transaction Success Rate**: > 99% for standard transactions
- **Recovery Success**: 100% recovery from page refresh
- **Flow Completion**: > 95% flow completion rate
- **Error Detection**: < 1% undetected transaction failures
- **Performance**: < 100ms overhead per transaction
- **Audit Coverage**: 100% of state transitions recorded
- **Debug Report Generation**: < 500ms for full report generation
- **Storage Efficiency**: < 5MB localStorage usage for audit trail
- **MTTR (Mean Time To Resolution)**: < 30 minutes for transaction issues with audit trail

## Security Considerations

1. **Private Key Protection**: Never store or log private keys
2. **Transaction Validation**: Validate all transaction parameters
3. **Replay Protection**: Include nonce management
4. **Storage Security**: Encrypt sensitive data in localStorage
5. **XSS Prevention**: Sanitize all user inputs

## Future Enhancements

1. **Transaction Batching**: Combine multiple transactions
2. **Cross-Chain Bridging**: Native bridge support
3. **MEV Protection**: Enhanced private mempool integration
4. **Analytics**: Transaction analytics and reporting
5. **Notification System**: Push notifications for transaction status
6. **Fee Abstraction**: Gasless transactions via relayers

## Conclusion

The Transaction Manager will provide a robust, extensible foundation for all transaction handling across ENS applications. By centralizing flow logic, improving error handling, and adding persistence, it will significantly improve the user experience and developer productivity while reducing transaction failures and user frustration.