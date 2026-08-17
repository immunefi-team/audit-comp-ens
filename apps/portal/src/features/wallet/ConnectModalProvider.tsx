import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useConnection } from 'wagmi'
import { ConnectWalletDialog } from './ConnectWalletDialog'

type ConnectModalContextValue = {
  /** Open the wallet-selection modal. */
  openConnectModal: () => void
  /** Whether the modal is currently open. */
  connectModalOpen: boolean
}

const ConnectModalContext = createContext<ConnectModalContextValue | null>(null)

// Stable no-op used when the provider isn't in the tree. In normal operation
// `ConnectModalProvider` is mounted at the app root, so this only surfaces
// after a hot-reload invalidates the context module (cleared by a page
// reload). Degrade gracefully rather than crash the whole route:
// `useConnectModal` no-ops outside its provider.
const NOOP_CONNECT_MODAL: ConnectModalContextValue = {
  openConnectModal: () => {},
  connectModalOpen: false,
}

/**
 * Owns the custom wallet-selection modal and exposes it through
 * `useConnectModal()` (stable `{ openConnectModal, connectModalOpen }` shape
 * for all consumers). Mount once, near
 * the root, inside `WagmiProvider`.
 */
export const ConnectModalProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false)
  const { isConnected } = useConnection()

  const openConnectModal = useCallback(() => setOpen(true), [])

  // Close the modal once a connection lands (covers connections that complete
  // outside the dialog, e.g. an eager reconnect).
  useEffect(() => {
    if (isConnected) setOpen(false)
  }, [isConnected])

  const value = useMemo(
    () => ({ openConnectModal, connectModalOpen: open }),
    [openConnectModal, open],
  )

  return (
    <ConnectModalContext.Provider value={value}>
      {children}
      <ConnectWalletDialog open={open} onOpenChange={setOpen} />
    </ConnectModalContext.Provider>
  )
}

export const useConnectModal = (): ConnectModalContextValue => {
  const context = useContext(ConnectModalContext)
  if (!context) {
    if (import.meta.env.DEV) {
      console.warn(
        'useConnectModal: no ConnectModalProvider found. This is usually a ' +
          'stale hot-reload boundary — reload the page. If it persists after ' +
          'a reload, a consumer is rendering outside ConnectModalProvider.',
      )
    }
    return NOOP_CONNECT_MODAL
  }
  return context
}
