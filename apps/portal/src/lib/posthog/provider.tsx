import { PostHogProvider } from '@posthog/react'
// @posthog/react types its `client` prop with the `PostHog` type from the
// default `posthog-js` build, which is a *nominally* distinct declaration from
// the no-external build's `PostHog` (private fields make them structurally
// incompatible even though they're the same runtime SDK). Import that type to
// cast our instance at the provider boundary below.
import type { PostHog } from 'posthog-js'
// Import the fully-bundled, no-external build so PostHog never lazy-loads its
// extension bundles (session recorder, surveys, dead-clicks, web-vitals,
// exception autocapture) at runtime. The default `posthog-js` build injects
// those via runtime <script> tags + an inline loader, both of which our strict
// CSP blocks (no 'unsafe-inline'; script-src is host/hash-pinned) — and our
// PostHog reverse proxy (jakob.ens.domains) doesn't serve the /static/*.js
// asset paths anyway. Pre-bundling sidesteps both problems. This disables the
// Toolbar (a dev-only feature we don't use in prod). See PostHog's CSP guide:
// https://posthog.com/docs/advanced/content-security-policy
import posthog from 'posthog-js/dist/module.full.no-external'
import { useEffect } from 'react'
import { useConnectionEffect } from 'wagmi'
import { track } from './events'

export const PHProvider = ({
  children,
}: {
  children: React.ReactNode
}): React.ReactNode => {
  useEffect(() => {
    posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
      capture_pageview: 'history_change',
      disable_session_recording: !!import.meta.env.DEV,
      defaults: '2025-11-30',
      person_profiles: 'identified_only',
    })
  }, [])

  useConnectionEffect({
    onConnect(data) {
      posthog.identify(
        data.address,
        {
          address: data.address,
        },
        {
          initial_address: data.address,
        },
      )

      posthog.register({
        wallet_address: data.address,
        chain_id: data.chainId,
        wallet_connector: data.connector.name,
      })

      track('wallet:connect', {
        wallet_address: data.address,
        chain_id: data.chainId,
        wallet_connector: data.connector.name,
      })
    },
    onDisconnect() {
      track('wallet:disconnect')
      posthog.reset()
    },
  })

  // Cast bridges the two posthog-js declaration files (see the type import
  // note above); the runtime object is the real PostHog SDK either way.
  return (
    <PostHogProvider client={posthog as unknown as PostHog}>
      {children}
    </PostHogProvider>
  )
}
