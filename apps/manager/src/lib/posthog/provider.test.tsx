import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PHProvider } from './provider'

const mocks = vi.hoisted(() => {
  const mockTrack = vi.fn()
  const mockTrackWithOptions = vi.fn()
  const mockUnsubscribe = vi.fn()
  const mockLiveUnsubscribe = vi.fn()
  const onFailedRunTelemetry = vi.fn(
    (_listener: (payload: Record<string, unknown>) => void) => mockUnsubscribe,
  )
  const onRunTelemetryEvent = vi.fn(
    (_listener: (payload: Record<string, unknown>) => void) =>
      mockLiveUnsubscribe,
  )
  return {
    mockTrack,
    mockTrackWithOptions,
    mockUnsubscribe,
    mockLiveUnsubscribe,
    onFailedRunTelemetry,
    onRunTelemetryEvent,
  }
})

vi.mock('@tanstack/react-router', () => ({
  useHydrated: () => true,
}))

vi.mock('@intercom/messenger-js-sdk', () => ({
  boot: vi.fn(),
  getVisitorId: () => 'visitor-id',
  trackEvent: vi.fn(),
}))

vi.mock('@posthog/react', () => ({
  PostHogProvider: ({ children }: { children: unknown }) => children,
}))

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    register: vi.fn(),
    get_distinct_id: () => 'distinct-id',
    get_session_replay_url: () => 'https://replay.example',
  },
}))

vi.mock('wagmi', () => ({
  useConnectionEffect: vi.fn(),
}))

vi.mock('@ens-apps/transaction-manager', () => ({
  transactionManager: {
    onFailedRunTelemetry: mocks.onFailedRunTelemetry,
    onRunTelemetryEvent: mocks.onRunTelemetryEvent,
  },
}))

vi.mock('./events', () => ({
  track: mocks.mockTrack,
  trackWithOptions: mocks.mockTrackWithOptions,
}))

describe('PHProvider failed run telemetry bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.onFailedRunTelemetry.mockImplementation(() => mocks.mockUnsubscribe)
    mocks.onRunTelemetryEvent.mockImplementation(
      () => mocks.mockLiveUnsubscribe,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('subscribes on mount and unsubscribes on unmount', () => {
    const view = render(
      <PHProvider>
        <div>child</div>
      </PHProvider>,
    )

    expect(mocks.onFailedRunTelemetry).toHaveBeenCalledTimes(1)
    expect(mocks.onRunTelemetryEvent).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(mocks.mockUnsubscribe).toHaveBeenCalledTimes(1)
    expect(mocks.mockLiveUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('tracks tm:failed_run payload when callback fires', () => {
    render(
      <PHProvider>
        <div>child</div>
      </PHProvider>,
    )

    const listener = mocks.onFailedRunTelemetry.mock.calls[0]?.[0] as
      | ((payload: Record<string, unknown>) => void)
      | undefined
    expect(listener).toBeDefined()

    listener?.({
      schemaVersion: 'tm-failed-run-v2',
      run: {
        runId: 'run-1',
        txId: 'tx-1',
        status: 'error',
        startedAt: 1,
        endedAt: 2,
        durationMs: 1,
      },
      initial: {
        txId: 'tx-1',
        createdAt: 1,
        useSmartAccount: false,
        options: { hasModalConfig: false },
        smartAccount: { enabled: false },
      },
      timeline: [],
      summary: {
        finalState: 'error.submission',
        failureStage: 'submission',
        attemptCount: 2,
        requestFingerprint: 'abc',
      },
      truncation: {
        truncated: false,
        droppedEvents: 0,
        totalEvents: 3,
      },
    })

    expect(mocks.mockTrack).toHaveBeenCalledTimes(1)
    expect(mocks.mockTrack).toHaveBeenCalledWith(
      'tm:failed_run',
      expect.objectContaining({
        tm_run_id: 'run-1',
        tm_tx_id: 'tx-1',
        tm_failure_stage: 'submission',
        tm_payload: expect.objectContaining({
          schemaVersion: 'tm-failed-run-v2',
        }),
        source_app: 'manager',
      }),
    )
  })

  it('swallows tracking errors from callback', () => {
    mocks.mockTrack.mockImplementationOnce(() => {
      throw new Error('posthog blocked')
    })

    render(
      <PHProvider>
        <div>child</div>
      </PHProvider>,
    )

    const listener = mocks.onFailedRunTelemetry.mock.calls[0]?.[0] as
      | ((payload: Record<string, unknown>) => void)
      | undefined

    expect(() =>
      listener?.({
        schemaVersion: 'tm-failed-run-v2',
        run: {
          runId: 'run-2',
          txId: 'tx-2',
          status: 'cancelled',
          startedAt: 1,
          endedAt: 2,
          durationMs: 1,
        },
        initial: {
          txId: 'tx-2',
          createdAt: 1,
          useSmartAccount: false,
          options: { hasModalConfig: false },
          smartAccount: { enabled: false },
        },
        timeline: [],
        summary: {
          finalState: 'error.cancelled',
          failureStage: 'cancelled',
          attemptCount: 0,
          requestFingerprint: 'abc',
        },
        truncation: {
          truncated: false,
          droppedEvents: 0,
          totalEvents: 1,
        },
      }),
    ).not.toThrow()
  })
})
