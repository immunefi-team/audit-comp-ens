// Must import from the same module path as provider.tsx — mixing the default
// `posthog-js` build with `module.full.no-external` would bundle PostHog twice
// and run two separate SDK instances. See provider.tsx for why we use this build.
import posthog from 'posthog-js/dist/module.full.no-external'

export type PostHogEvents = {
  'wallet:connect': {
    wallet_address: string
    chain_id: number
    wallet_connector: string
  }

  'wallet:disconnect': undefined
}

export type PostHogEvent = keyof PostHogEvents

export function track<N extends PostHogEvent>(
  name: N,
  ...args: PostHogEvents[N] extends undefined ? [] : [PostHogEvents[N]]
): void {
  posthog.capture(name, args[0])
}
