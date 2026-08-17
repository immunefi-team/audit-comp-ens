import { useHydrated } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useConnection } from 'wagmi'
import { useSmartAccountContext } from '@/lib/smart-account/SmartAccountContext'

/**
 * useOnDisconnected
 *
 * Calls `onDisconnect` once the wallet is genuinely, finally disconnected.
 *
 * The disconnect *signal* is wagmi's connection status — the immediate source
 * of truth — NOT the smart-account machine's derived `isConnected`, which lags
 * during the reconnect window (wagmi reconnected, machine not yet synced).
 * Reading that gap as a disconnect fired a spurious `navigate()` mid-reload
 * that raced TanStack Router and blanked the page (`Outlet` throwing
 * `undefined`).
 *
 * It is still *gated* on hydration, wagmi not (re)connecting, and the
 * smart-account provider having finished its initial restoration
 * (`hasInitialized`) — so a session that is still being restored on load is
 * never bounced to the landing page. The hook also waits until it has observed
 * an active connection/reconnection before firing, so the initial hard-load
 * `disconnected` frame is not treated as a user disconnect.
 *
 * @param onDisconnect Callback to call when the wallet is disconnected.
 */
export const useOnDisconnected = (onDisconnect: () => void) => {
  const isHydrated = useHydrated()
  const { status, isConnecting, isReconnecting } = useConnection()
  const { hasInitialized } = useSmartAccountContext()
  const hasSeenActiveConnectionRef = useRef(false)

  useEffect(() => {
    if (status === 'connected' || isConnecting || isReconnecting) {
      hasSeenActiveConnectionRef.current = true
    }

    if (!isHydrated || isConnecting || isReconnecting || !hasInitialized) {
      return
    }
    if (status === 'disconnected' && hasSeenActiveConnectionRef.current) {
      onDisconnect()
    }
  }, [
    status,
    isHydrated,
    isConnecting,
    isReconnecting,
    hasInitialized,
    onDisconnect,
  ])
}
