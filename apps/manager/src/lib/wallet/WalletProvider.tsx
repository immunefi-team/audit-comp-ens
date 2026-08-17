import { CustomWalletStack } from './stacks/CustomWalletStack'

// Thin entry for the wallet layer — mounts the vendor stack (the custom wagmi
// stack today) so a second vendor can slot in here without touching
// RootProviders.
export const WalletProvider = ({ children }: { children: React.ReactNode }) => (
  <CustomWalletStack>{children}</CustomWalletStack>
)
