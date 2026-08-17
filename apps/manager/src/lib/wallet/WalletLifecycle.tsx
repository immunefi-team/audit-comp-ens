import { transactionManager } from '@ens-apps/transaction-manager'
import posthog from 'posthog-js'
import { useEffect } from 'react'
import { useConnection, useConnectionEffect } from 'wagmi'
import { track } from '@/lib/posthog/events'
import { backendAuthStore } from '@/utils/backend-client'

// Blanket localStorage.clear() corrupts reconnection — preserve wagmi.*
// (wagmi's connection storage).
//
// Also preserve the standalone-HCA session store (`ens-sessions-*`): a valid,
// non-expired scoped session must survive disconnect/reconnect so the next
// registration reuses it with ZERO wallet prompts (per the HCA handoff doc —
// "a valid session supports later ENS actions without another wallet prompt").
// Wiping it here forced a re-ENABLE on every reconnect. Cross-owner safety is
// handled separately by `removeSessionsByOwner` on an actual owner switch, and
// each session is owner+chain+HCA scoped and on-chain-expiring, so keeping it
// across a disconnect is safe.
const PRESERVED_KEY_PREFIXES = ['wagmi', 'ens-session'] as const
const clearAppLocalStorage = () => {
  for (const key of Object.keys(localStorage)) {
    if (PRESERVED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)))
      continue
    localStorage.removeItem(key)
  }
}

// Drops stale backend auth + transactions on an account switch, and tears
// everything down on disconnect. Renders nothing.
export const WalletLifecycle = () => {
  const { address } = useConnection()

  useEffect(() => {
    if (!address) return

    const authedAddress = backendAuthStore.get().context.address
    if (
      authedAddress &&
      authedAddress.toLowerCase() !== address.toLowerCase()
    ) {
      transactionManager.clearAllAndPersistence()
      backendAuthStore.trigger.signOut()
    }
  }, [address])

  useConnectionEffect({
    onDisconnect() {
      transactionManager.clearAllAndPersistence()
      backendAuthStore.trigger.signOut()
      clearAppLocalStorage()
      track('wallet:disconnect')
      posthog.reset()
    },
  })

  return null
}
