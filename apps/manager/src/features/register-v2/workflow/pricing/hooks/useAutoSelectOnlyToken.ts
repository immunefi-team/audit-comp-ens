import type { SUPPORTED_TOKEN } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { useEffect } from 'react'
import type { StablecoinBalance } from '@/lib/smart-account'

/**
 * Selects the sole payment option once balances have loaded. Leaves the choice
 * alone when the user has already picked one or several options exist.
 */
export const useAutoSelectOnlyToken = ({
  selectedToken,
  stablecoinBalances,
  isLoadingBalances,
  onSelectCoin,
}: {
  readonly selectedToken: SUPPORTED_TOKEN | undefined
  readonly stablecoinBalances: readonly StablecoinBalance[] | undefined
  readonly isLoadingBalances: boolean
  readonly onSelectCoin: (coin: SUPPORTED_TOKEN) => void
}) => {
  useEffect(() => {
    const onlyCoin = stablecoinBalances?.length === 1 && stablecoinBalances[0]
    if (selectedToken || isLoadingBalances || !onlyCoin) return
    onSelectCoin(onlyCoin.symbol as SUPPORTED_TOKEN)
  }, [selectedToken, isLoadingBalances, stablecoinBalances, onSelectCoin])
}
