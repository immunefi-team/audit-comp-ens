import { useCallback } from 'react'
import { useDisconnect } from 'wagmi'

// Sign-out. When the vendor changes, swap the body (e.g. Privy logout + wagmi
// disconnect) — call sites keep calling this. `isDisconnecting` comes straight
// from the mutation so callers don't track it themselves.
export const useWalletDisconnect = () => {
  const { mutateAsync, isPending } = useDisconnect()
  const disconnect = useCallback(async () => {
    await mutateAsync().catch(() => {})
  }, [mutateAsync])
  return { disconnect, isDisconnecting: isPending }
}
