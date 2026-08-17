import { WagmiProvider } from 'wagmi'
import { isMockWalletEnabled } from '@/lib/mockWallet.mock'
import { wagmiConfig } from '@/lib/wagmi'
import { MockWalletAutoConnect } from '../MockWalletAutoConnect'
import { ConnectModalProvider } from './custom/ConnectModalProvider'

// Custom wagmi wallet stack: injected wallets arrive via
// EIP-6963 discovery, WalletConnect is the only explicit connector, and the
// wallet-selection UI is our own dialog (see ./custom/). Same pattern as the
// portal app, restyled with the manager's ui kit.
export const CustomWalletStack = ({
  children,
}: {
  children: React.ReactNode
}) => (
  <WagmiProvider config={wagmiConfig}>
    {isMockWalletEnabled && <MockWalletAutoConnect />}
    <ConnectModalProvider>{children}</ConnectModalProvider>
  </WagmiProvider>
)
