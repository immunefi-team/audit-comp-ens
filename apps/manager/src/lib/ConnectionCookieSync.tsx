import { useEffect, useRef } from 'react'
import { useConnection } from 'wagmi'
import { setConnectionCookie } from './connection-cookie'

/**
 * ConnectionCookieSync
 *
 * Mirrors the connected wallet address from wagmi into the connection
 * cookie so server-side route guards can read it. Renders nothing.
 */
export const ConnectionCookieSync = () => {
  const { address, isReconnecting } = useConnection()
  // `undefined` = not yet synced. Distinguishing it from `null` (no wallet)
  // ensures the first settled run clears a stale cookie when wagmi restores
  // no address on load — otherwise SSR guards keep treating it as connected.
  const previousAddressRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    // Wait until reconnection settles so we don't clear the cookie during the
    // brief window where the connector is still restoring the session.
    if (isReconnecting) return

    const nextAddress = address ?? null

    if (nextAddress === previousAddressRef.current) return

    previousAddressRef.current = nextAddress
    void setConnectionCookie(nextAddress)
  }, [address, isReconnecting])

  return null
}
