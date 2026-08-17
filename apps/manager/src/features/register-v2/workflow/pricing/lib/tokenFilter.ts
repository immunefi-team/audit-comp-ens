import type { StablecoinBalance } from '@/lib/smart-account'

export const filterStablecoinBalances = (
  balances: StablecoinBalance[] | undefined,
  searchQuery: string,
): StablecoinBalance[] => {
  if (!balances || balances.length === 0) {
    return []
  }

  if (!searchQuery.trim()) {
    return balances
  }

  const query = searchQuery.toLowerCase().trim()

  return balances.filter(
    (coin) =>
      coin.symbol.toLowerCase().includes(query) ||
      'sepolia'.includes(query) ||
      `sepolia ${coin.symbol}`.toLowerCase().includes(query),
  )
}
