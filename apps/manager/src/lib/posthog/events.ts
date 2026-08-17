import type { FailedRunPayloadV2 } from '@ens-apps/transaction-manager'
import posthog, { type CaptureOptions } from 'posthog-js'

export type PostHogEvents = {
  'name:search_selected': {
    name: string
    source: 'header_search'
  }

  'wallet:connect': {
    wallet_address: string
    chain_id: number
    wallet_connector: string
  }

  'wallet:disconnect': undefined

  'intercom:booted': undefined

  'tm:failed_run': {
    tm_payload: FailedRunPayloadV2
    tm_run_id: string
    tm_tx_id: string
    tm_status: 'error' | 'cancelled'
    tm_failure_stage: string
    tm_state_final: string
    tm_chain_id?: number
    tm_intent_type?: string
    tm_request_type?: string
    tm_signer_type?: string
    tm_error_name?: string
    tm_error_cause_name?: string
    tm_hash?: string
    tm_userop_hash?: string
    tm_retry_count: number
    tm_event_count: number
    tm_truncated: boolean
    tm_dropped_events: number
    source_app: 'manager'
    build_env: string
  }
}

export type PostHogEvent = keyof PostHogEvents

export function track<N extends PostHogEvent>(
  name: N,
  ...args: PostHogEvents[N] extends undefined ? [] : [PostHogEvents[N]]
): void {
  posthog.capture(name, args[0])
}

export function trackWithOptions<N extends PostHogEvent>(
  name: N,
  args: PostHogEvents[N],
  options: CaptureOptions,
): void {
  posthog.capture(name, args, options)
}
