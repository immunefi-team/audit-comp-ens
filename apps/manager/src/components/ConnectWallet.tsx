import { useConnection } from 'wagmi'
import { useConnectModal } from '@/lib/wallet'

// Disconnected-only: openConnectModal is undefined once connected, and the
// connected-state UI lives in the Header.
export const ConnectWallet = () => {
  const { openConnectModal } = useConnectModal()
  const { isConnected } = useConnection()
  if (isConnected) return null
  return (
    <button onClick={() => openConnectModal?.()} type="button">
      Connect Wallet
    </button>
  )
}
