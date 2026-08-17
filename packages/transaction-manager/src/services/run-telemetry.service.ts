import type {
  FailedRunPayloadV2,
  SerializedRunError,
  TransactionPhase,
  TransactionRunEventV2,
  TransactionRunInitialSnapshot,
  TransactionRunStatus,
} from '../types/audit.types'
import type { Signer } from '../types/signer.types'
import {
  getPrimaryCall,
  type TransactionIntent,
  type TransactionOptions,
  type TransactionRequest,
} from '../types/transaction.types'

const MAX_TELEMETRY_BYTES = 900 * 1024

interface RunBootstrapInput {
  txId: string
  chainId?: number
  intent?: TransactionIntent
  request?: TransactionRequest
  signer?: Signer
  options?: TransactionOptions
  useSmartAccount?: boolean
}

interface SnapshotLike {
  value: unknown
  context: {
    hash?: string
    userOpHash?: string
    error?: unknown
    retryCount?: number
    fallbackChecks?: number
    chainId?: number
    useSmartAccount?: boolean
    request?: {
      type?: string
      from?: string
      to?: string
      value?: bigint
      data?: string
      nonce?: number
      gas?: bigint
      gasPrice?: bigint
      maxFeePerGas?: bigint
      maxPriorityFeePerGas?: bigint
    }
    intent?: { type?: string }
    signer?: { type?: string }
    receipt?: { status?: string; gasUsed?: bigint }
    options?: {
      confirmations?: number
      timeout?: number
      retryDelay?: number
      retryCount?: number
      usePrivateMempool?: boolean
      modal?: unknown
    }
  }
}

interface RunData {
  runId: string
  txId: string
  startedAt: number
  initial: TransactionRunInitialSnapshot
  timeline: TransactionRunEventV2[]
  lastTimestamp: number
  lastErrorFingerprint?: string
}

function randomId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return `run-${Date.now()}-${Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`
  }
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function toStringSafe(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (typeof value === 'bigint') return value.toString()
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function toBigIntString(value: unknown): string | undefined {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') return value
  return undefined
}

function hashString(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}

function stringifyState(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function serializeError(
  error: unknown,
  options?: { includeStack?: boolean; depth?: number },
): SerializedRunError | undefined {
  if (!error) return undefined

  const depth = options?.depth ?? 2

  if (error instanceof Error) {
    const withCode = error as Error & {
      code?: string | number
      cause?: unknown
    }
    return {
      name: error.name,
      message: error.message,
      stack: options?.includeStack ? error.stack : undefined,
      code: withCode.code,
      cause:
        depth > 0
          ? serializeError(withCode.cause, {
              includeStack: false,
              depth: depth - 1,
            })
          : undefined,
    }
  }

  if (typeof error === 'string') {
    return {
      message: error,
    }
  }

  if (typeof error === 'object') {
    const value = error as {
      name?: unknown
      message?: unknown
      stack?: unknown
      code?: unknown
      cause?: unknown
    }

    return {
      name: typeof value.name === 'string' ? value.name : undefined,
      message:
        typeof value.message === 'string' ? value.message : toStringSafe(error),
      stack:
        options?.includeStack && typeof value.stack === 'string'
          ? value.stack
          : undefined,
      code:
        typeof value.code === 'string' || typeof value.code === 'number'
          ? value.code
          : undefined,
      cause:
        depth > 0
          ? serializeError(value.cause, {
              includeStack: false,
              depth: depth - 1,
            })
          : undefined,
    }
  }

  return {
    message: String(error),
  }
}

function errorFingerprint(
  error: SerializedRunError | undefined,
): string | undefined {
  if (!error) return undefined
  return [error.name || '', error.message || '', error.code || ''].join('|')
}

function parsePhase(value: unknown): {
  phase: TransactionPhase
  substate?: string
} {
  if (typeof value === 'string') {
    const phase = value as TransactionPhase
    return {
      phase,
    }
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: entries is guaranteed to have at least one element
      const [key, sub] = entries[0]!
      if (key === 'error') {
        return {
          phase: 'error',
          substate: toStringSafe(sub),
        }
      }

      return {
        phase: key as TransactionPhase,
        substate: toStringSafe(sub),
      }
    }
  }

  return {
    phase: 'unknown',
    substate: toStringSafe(value),
  }
}

function deriveReason(
  previous: TransactionRunEventV2 | undefined,
  phase: TransactionPhase,
  substate: string | undefined,
  snapshot: SnapshotLike,
): string {
  if (!previous) return 'run_started'

  if (phase === 'error') {
    if (substate === 'cancelled') return 'cancelled'
    if (substate === 'timeout') return 'receipt_timeout'
    if (substate === 'reverted') return 'receipt_reverted'
    if (substate === 'submission') return 'submission_failed'
    if (substate === 'preparation') return 'prepare_failed'
    return 'error_state_entered'
  }

  if (phase === 'retrying') return 'retry_scheduled'

  if (previous.phase === 'retrying' && phase === 'submitting') {
    return 'retry_wait_done'
  }

  if (phase === 'pending') return 'submitted_waiting_receipt'
  if (phase === 'checkingFallback') return 'fallback_eth_call'
  if (phase === 'confirming') return 'receipt_received'
  if (phase === 'success') return 'transaction_succeeded'

  if (snapshot.context.error) {
    return 'state_progress_with_error_context'
  }

  return phase === previous.phase ? 'state_stable' : 'state_transition'
}

function getPhaseContext(
  phase: TransactionPhase,
  substate: string | undefined,
  snapshot: SnapshotLike,
): Record<string, unknown> {
  const context = snapshot.context

  if (phase === 'preparing') {
    return {
      intentType: context.intent?.type,
      chainId: context.chainId,
      useSmartAccount: context.useSmartAccount,
    }
  }

  if (phase === 'submitting') {
    return {
      requestType: context.request?.type,
      signerType: context.signer?.type,
      retryCount: context.retryCount,
    }
  }

  if (phase === 'pending') {
    return {
      hash: context.hash,
      confirmations: context.options?.confirmations,
      timeout: context.options?.timeout,
      fallbackChecks: context.fallbackChecks,
    }
  }

  if (phase === 'retrying') {
    return {
      retryCount: context.retryCount,
      retryDelay: context.options?.retryDelay,
    }
  }

  if (phase === 'confirming') {
    return {
      hash: context.hash,
      receiptStatus: context.receipt?.status,
      gasUsed: toBigIntString(context.receipt?.gasUsed),
    }
  }

  if (phase === 'checkingFallback') {
    return {
      requestType: context.request?.type,
      fallbackChecks: context.fallbackChecks,
      hash: context.hash,
    }
  }

  if (phase === 'error') {
    return {
      failureStage: substate,
      retryCount: context.retryCount,
      hash: context.hash,
      requestType: context.request?.type,
      receiptStatus: context.receipt?.status,
    }
  }

  if (phase === 'success') {
    return {
      hash: context.hash,
      userOpHash: context.userOpHash,
      receiptStatus: context.receipt?.status,
      gasUsed: toBigIntString(context.receipt?.gasUsed),
    }
  }

  return {
    retryCount: context.retryCount,
    hash: context.hash,
    requestType: context.request?.type,
  }
}

function dataByteLength(data: string | undefined): number | undefined {
  if (!data) return undefined
  return data.startsWith('0x')
    ? Math.max(0, (data.length - 2) / 2)
    : data.length
}

function dataSelector(data: string | undefined): string | undefined {
  return data?.startsWith('0x') && data.length >= 10
    ? data.slice(0, 10)
    : undefined
}

function buildRequestSnapshot(
  request: TransactionRequest | undefined,
): TransactionRunInitialSnapshot['request'] {
  if (!request) return undefined

  // `calls` is the single source of truth for what executes on-chain. For an
  // EOA request the primary call is the top-level tx; for a Rhinestone intent
  // it is the first call in the batch. Summaries below derive from this rather
  // than from a second, divergence-prone copy of the call data.
  const primary = getPrimaryCall(request)
  const data = primary?.data

  const calls =
    request.type === 'rhinestone-intent'
      ? request.rhinestoneParams.calls
      : undefined
  const callCount = calls ? calls.length : 1

  return {
    from: request.from,
    to: primary?.to,
    value: toBigIntString(primary?.value),
    nonce:
      typeof (request as { nonce?: unknown }).nonce === 'number'
        ? (request as { nonce?: number }).nonce
        : undefined,
    gas: 'gas' in request ? toBigIntString(request.gas) : undefined,
    gasPrice:
      'gasPrice' in request ? toBigIntString(request.gasPrice) : undefined,
    maxFeePerGas:
      'maxFeePerGas' in request
        ? toBigIntString(request.maxFeePerGas)
        : undefined,
    maxPriorityFeePerGas:
      'maxPriorityFeePerGas' in request
        ? toBigIntString(request.maxPriorityFeePerGas)
        : undefined,
    data,
    dataBytes: dataByteLength(data),
    dataSelector: dataSelector(data),
    callCount,
    // Only emit the per-call breakdown for genuine batches so single-call
    // requests stay compact (the top-level fields already describe them).
    calls:
      calls && calls.length > 1
        ? calls.map((call) => ({
            to: call.to,
            value: toBigIntString(call.value),
            dataBytes: dataByteLength(call.data),
            dataSelector: dataSelector(call.data),
          }))
        : undefined,
  }
}

function getRequestFingerprint(initial: TransactionRunInitialSnapshot): string {
  const parts = [
    initial.chainId || '',
    initial.intentType || '',
    initial.requestType || '',
    initial.request?.from || '',
    initial.request?.to || '',
    initial.request?.value || '',
    initial.request?.data || '',
  ]
  return hashString(parts.join('|'))
}

function buildInitialSnapshot(
  input: RunBootstrapInput,
): TransactionRunInitialSnapshot {
  const request = input.request

  return {
    txId: input.txId,
    createdAt: Date.now(),
    chainId: input.chainId || request?.chainId,
    intentType: input.intent?.type,
    requestType: request?.type,
    signerType: input.signer?.type,
    useSmartAccount: Boolean(input.useSmartAccount),
    options: {
      retryCount: input.options?.retryCount,
      retryDelay: input.options?.retryDelay,
      timeout: input.options?.timeout,
      confirmations: input.options?.confirmations,
      usePrivateMempool: input.options?.usePrivateMempool,
      hasModalConfig: Boolean(input.options?.modal),
    },
    request: buildRequestSnapshot(request),
    smartAccount: {
      enabled: Boolean(input.useSmartAccount || input.signer?.type !== 'eoa'),
      signerType: input.signer?.type,
    },
  }
}

function trimTimelineForSize(payload: FailedRunPayloadV2): FailedRunPayloadV2 {
  if (estimateTelemetryBytes(payload) <= MAX_TELEMETRY_BYTES) return payload

  const important = payload.timeline.filter(
    (event) =>
      event.phase === 'error' || event.phase === 'retrying' || event.isTerminal,
  )
  const normal = payload.timeline.filter(
    (event) =>
      event.phase !== 'error' &&
      event.phase !== 'retrying' &&
      !event.isTerminal,
  )

  let normalHead = Math.min(12, normal.length)
  let normalTail = Math.min(24, Math.max(0, normal.length - normalHead))
  let importantEvents = important.slice()

  const buildWithNormal = (
    headCount: number,
    tailCount: number,
    importantChunk: TransactionRunEventV2[],
  ) => {
    const timeline = [
      ...importantChunk,
      ...normal.slice(0, headCount),
      ...normal.slice(Math.max(0, normal.length - tailCount)),
    ].sort((a, b) => a.sequence - b.sequence)

    const unique = timeline.filter((event, index) => {
      return (
        index ===
        timeline.findIndex((candidate) => candidate.sequence === event.sequence)
      )
    })

    return {
      ...payload,
      timeline: unique,
      truncation: {
        truncated: true,
        droppedEvents: Math.max(0, payload.timeline.length - unique.length),
        totalEvents: payload.truncation.totalEvents,
      },
    }
  }

  let candidate = buildWithNormal(normalHead, normalTail, importantEvents)

  while (estimateTelemetryBytes(candidate) > MAX_TELEMETRY_BYTES) {
    if (normalHead > 0 || normalTail > 0) {
      if (normalTail > normalHead && normalTail > 0) {
        normalTail -= 1
      } else if (normalHead > 0) {
        normalHead -= 1
      } else if (normalTail > 0) {
        normalTail -= 1
      }
    } else if (importantEvents.length > 1) {
      const terminalSequence =
        payload.timeline[payload.timeline.length - 1]?.sequence
      const removable = importantEvents.filter(
        (event) => event.sequence !== terminalSequence,
      )
      if (removable.length === 0) break
      const kept = removable.filter((_event, index) => index % 2 === 0)
      const terminal = importantEvents.find(
        (event) => event.sequence === terminalSequence,
      )
      importantEvents = terminal ? [...kept, terminal] : kept
    } else {
      break
    }

    candidate = buildWithNormal(normalHead, normalTail, importantEvents)
  }

  if (estimateTelemetryBytes(candidate) <= MAX_TELEMETRY_BYTES) {
    return candidate
  }

  if (
    candidate.initial.request?.data &&
    candidate.initial.request.data.length > 4096
  ) {
    const withShortData: FailedRunPayloadV2 = {
      ...candidate,
      initial: {
        ...candidate.initial,
        request: {
          ...candidate.initial.request,
          data: `${candidate.initial.request.data.slice(0, 4096)}...`,
          dataTruncated: true,
        },
      },
    }

    if (estimateTelemetryBytes(withShortData) <= MAX_TELEMETRY_BYTES) {
      return withShortData
    }
  }

  return candidate
}

function shouldDedupeEvent(
  previous: TransactionRunEventV2 | undefined,
  current: TransactionRunEventV2,
): boolean {
  if (!previous) return false

  const prevError = errorFingerprint(previous.error)
  const nextError = errorFingerprint(current.error)

  return (
    previous.phase === current.phase &&
    previous.substate === current.substate &&
    previous.retryCount === current.retryCount &&
    previous.hash === current.hash &&
    previous.userOpHash === current.userOpHash &&
    prevError === nextError
  )
}

export function estimateTelemetryBytes(payload: unknown): number {
  const encoded = new TextEncoder().encode(JSON.stringify(payload))
  return encoded.byteLength
}

export function createRunTelemetryService() {
  const runs = new Map<string, RunData>()

  function startRun(input: RunBootstrapInput): void {
    const initial = buildInitialSnapshot(input)

    runs.set(input.txId, {
      runId: randomId(),
      txId: input.txId,
      startedAt: Date.now(),
      initial,
      timeline: [],
      lastTimestamp: Date.now(),
    })
  }

  function recordSnapshot(
    txId: string,
    snapshot: SnapshotLike,
  ): { runId: string; event: TransactionRunEventV2 } | null {
    const run = runs.get(txId)
    if (!run) return null

    const now = Date.now()
    const previous = run.timeline[run.timeline.length - 1]
    const { phase, substate } = parsePhase(snapshot.value)
    const reason = deriveReason(previous, phase, substate, snapshot)

    const serializedState = stringifyState(snapshot.value)
    const isTerminal = phase === 'success' || phase === 'error'

    let error = serializeError(snapshot.context.error, {
      includeStack: isTerminal && phase === 'error',
      depth: 2,
    })

    const currentFingerprint = errorFingerprint(error)
    const unchangedError =
      currentFingerprint !== undefined &&
      currentFingerprint === run.lastErrorFingerprint

    const shouldKeepError =
      phase === 'error' || phase === 'retrying' || !unchangedError

    if (!shouldKeepError) {
      error = undefined
    }

    if (currentFingerprint) {
      run.lastErrorFingerprint = currentFingerprint
    }

    const event: TransactionRunEventV2 = {
      sequence: run.timeline.length,
      timestamp: now,
      deltaMs: previous ? Math.max(0, now - previous.timestamp) : 0,
      phase,
      substate,
      reason,
      state: serializedState,
      retryCount: snapshot.context.retryCount ?? 0,
      hash: snapshot.context.hash,
      userOpHash: snapshot.context.userOpHash,
      context: getPhaseContext(phase, substate, snapshot),
      error,
      isTerminal,
    }

    if (shouldDedupeEvent(previous, event)) {
      run.lastTimestamp = now
      return null
    }

    run.timeline.push(event)
    run.lastTimestamp = now
    return {
      runId: run.runId,
      event,
    }
  }

  function completeRun(
    txId: string,
    terminalStatus: TransactionRunStatus,
  ): FailedRunPayloadV2 | null {
    const run = runs.get(txId)
    runs.delete(txId)
    if (!run) return null
    if (terminalStatus === 'success') return null

    const endedAt = Date.now()
    const firstError = run.timeline.find((entry) => entry.error)?.error
    const finalEvent = run.timeline[run.timeline.length - 1]
    const finalError = finalEvent?.error

    const payload: FailedRunPayloadV2 = {
      schemaVersion: 'tm-failed-run-v2',
      run: {
        runId: run.runId,
        txId,
        status: terminalStatus,
        startedAt: run.startedAt,
        endedAt,
        durationMs: Math.max(0, endedAt - run.startedAt),
      },
      initial: run.initial,
      timeline: run.timeline,
      summary: {
        finalState: finalEvent?.state || 'unknown',
        failureStage:
          finalEvent?.substate ||
          (terminalStatus === 'cancelled' ? 'cancelled' : 'unknown'),
        attemptCount: Math.max(
          0,
          ...run.timeline.map((item) => item.retryCount),
        ),
        firstErrorName: firstError?.name,
        finalErrorName: finalError?.name,
        finalError,
        chainId: run.initial.chainId,
        intentType: run.initial.intentType,
        requestType: run.initial.requestType,
        signerType: run.initial.signerType,
        hash: finalEvent?.hash,
        userOpHash: finalEvent?.userOpHash,
        requestFingerprint: getRequestFingerprint(run.initial),
      },
      truncation: {
        truncated: false,
        droppedEvents: 0,
        totalEvents: run.timeline.length,
      },
    }

    return trimTimelineForSize(payload)
  }

  return {
    startRun,
    recordSnapshot,
    completeRun,
    clear: () => {
      runs.clear()
    },
  }
}
