import type { EOASigner } from '@ens-apps/transaction-manager'
import type { WalletClient } from 'viem'

export function createEOASigner(walletClient: WalletClient): EOASigner {
  return {
    type: 'eoa',
    walletClient,
  }
}
