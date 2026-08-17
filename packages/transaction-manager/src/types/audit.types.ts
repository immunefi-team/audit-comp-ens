export type TransactionRunStatus = 'success' | 'error' | 'cancelled'

export type TransactionPhase =
  | 'idle'
  | 'preparing'
  | 'submitting'
  | 'pending'
  | 'checkingFallback'
  | 'confirming'
  | 'retrying'
  | 'success'
  | 'error'
  | 'unknown'

export interface SerializedRunError {
  name?: string
  message?: string
  stack?: string
  code?: string | number
  cause?: SerializedRunError
}

export interface TransactionRunEventV2 {
  sequence: number
  timestamp: number
  deltaMs: number
  phase: TransactionPhase
  substate?: string
  reason: string
  state: string
  retryCount: number
  hash?: string
  userOpHash?: string
  context: Record<string, unknown>
  error?: SerializedRunError
  isTerminal: boolean
}

export interface TransactionRunInitialSnapshot {
  txId: string
  createdAt: number
  chainId?: number
  intentType?: string
  requestType?: string
  signerType?: string
  useSmartAccount: boolean
  options: {
    retryCount?: number
    retryDelay?: number
    timeout?: number
    confirmations?: number
    usePrivateMempool?: boolean
    hasModalConfig: boolean
  }
  request?: {
    from?: string
    /** Representative call target — primary call for batched intents. */
    to?: string
    value?: string
    nonce?: number
    gas?: string
    gasPrice?: string
    maxFeePerGas?: string
    maxPriorityFeePerGas?: string
    /** Representative call data — primary call for batched intents. */
    data?: string
    dataTruncated?: boolean
    dataBytes?: number
    dataSelector?: string
    /**
     * Number of on-chain calls in this request. 1 for EOA transactions; for
     * Rhinestone intents this reflects the full batch (so multi-call intents
     * are no longer under-represented as a single top-level call).
     */
    callCount?: number
    /** Per-call summary for batched intents (only present when callCount > 1). */
    calls?: Array<{
      to?: string
      value?: string
      dataBytes?: number
      dataSelector?: string
    }>
  }
  smartAccount: {
    enabled: boolean
    signerType?: string
    accountType?: string
  }
}

export interface FailedRunPayloadV2 {
  schemaVersion: 'tm-failed-run-v2'
  run: {
    runId: string
    txId: string
    status: Exclude<TransactionRunStatus, 'success'>
    startedAt: number
    endedAt: number
    durationMs: number
  }
  initial: TransactionRunInitialSnapshot
  timeline: TransactionRunEventV2[]
  summary: {
    finalState: string
    failureStage: string
    attemptCount: number
    firstErrorName?: string
    finalErrorName?: string
    finalError?: SerializedRunError
    chainId?: number
    intentType?: string
    requestType?: string
    signerType?: string
    hash?: string
    userOpHash?: string
    requestFingerprint: string
  }
  truncation: {
    truncated: boolean
    droppedEvents: number
    totalEvents: number
  }
}

export type RunTelemetrySubscriber = (payload: FailedRunPayloadV2) => void

export type RunTelemetryEventSubscriber = (event: {
  runId: string
  txId: string
  status?: TransactionRunStatus
  event: TransactionRunEventV2
}) => void
