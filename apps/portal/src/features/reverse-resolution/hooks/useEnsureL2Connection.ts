/**
 * Ensures the local `l2WagmiConfig` has an active connection matching the
 * currently-connected global connector.
 *
 * Why this exists:
 *   wagmi's per-config state is independent — the global `WagmiProvider`'s
 *   connection does NOT carry over to `l2WagmiConfig`. Without an active
 *   connection on the L2 config, both `switchChain` and `writeContract`
 *   silently fall through to no-op state updates instead of prompting the
 *   wallet. We "re-attach" the same EIP-1193 provider by calling `connect`
 *   on the L2 config with a connector matching the global one's id.
 *
 *   For injected / MetaMask / Frame this is silent (the provider is shared).
 *
 * Implementation note:
 *   This used to subscribe via `useConnect` + `useConnections`, but those
 *   hooks return fresh references every render which caused the returned
 *   callback to change identity on every render, propagating into a
 *   "Maximum update depth exceeded" loop when consumers had it in their
 *   own deps (e.g. `useSwitchToRequiredNetwork` -> `switchChainAsync`).
 *
 *   Instead we read state imperatively via `getConnections(l2WagmiConfig)`
 *   and trigger connection via the imperative `connect` action. The returned
 *   callback only depends on `globalConnector?.id`, so its identity is stable
 *   as long as the user's connector doesn't change.
 */

import { connect, getConnections } from '@wagmi/core'
import { useCallback } from 'react'
import { useAccount } from 'wagmi'
import { l2WagmiConfig } from '@/lib/wagmiL2'

export function useEnsureL2Connection() {
  const { connector: globalConnector } = useAccount()
  const globalConnectorId = globalConnector?.id

  return useCallback(async () => {
    if (!globalConnector || !globalConnectorId) {
      throw new Error('Wallet not connected')
    }
    const existing = getConnections(l2WagmiConfig)
    if (existing.some((c) => c.connector.id === globalConnectorId)) {
      return
    }
    // `l2WagmiConfig.connectors` is a static array of pre-bound connector
    // instances (see `createConfig` call in `@/lib/wagmiL2`).
    const matching = l2WagmiConfig.connectors.find(
      (c) => c.id === globalConnectorId,
    )
    if (!matching) {
      throw new Error(
        `No matching L2 connector for "${globalConnectorId}" — cannot perform L2 action.`,
      )
    }
    await connect(l2WagmiConfig, { connector: matching })
  }, [globalConnector, globalConnectorId])
}
