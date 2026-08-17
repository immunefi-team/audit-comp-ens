import { useEffect } from 'react'
import { useConnect, useConnection } from 'wagmi'
import { MOCK_CONNECTOR_ID } from '@/lib/mockWallet.mock'

// Keeps the mock wallet connected across reloads. wagmi's `mock` connector only
// tracks connection in an in-memory flag that resets on every page load, so
// `isAuthorized()` returns false on a fresh load and `reconnectOnMount` can't
// restore the session on its own. Whenever the account drops to `disconnected`,
// reconnect programmatically so the app boots already connected.
const useMockWalletAutoConnect = () => {
  const { status } = useConnection()
  const { connect, connectors } = useConnect()

  useEffect(() => {
    if (status !== 'disconnected') return
    const mockConnector = connectors.find(
      (connector) => connector.id === MOCK_CONNECTOR_ID,
    )
    if (mockConnector) connect({ connector: mockConnector })
  }, [status, connect, connectors])
}

// Only mounted when `isMockWalletEnabled` (see `stacks/CustomWalletStack.tsx`).
export const MockWalletAutoConnect = () => {
  useMockWalletAutoConnect()
  return null
}
