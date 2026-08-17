// TODO: Add support for other locales
export function formatAmount(
  amount: number,
  decimals: 0 | 2 = 0,
  locale: 'en-US' = 'en-US',
): string {
  return amount.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function parseBalance(balance?: string): number {
  if (!balance) return 0
  const cleaned = balance.replace(/[$,]/g, '').trim()
  const withoutToken = cleaned.replace(/\s*(USDC|DAI|USDT|ETH)\s*/i, '').trim()
  const parsed = parseFloat(withoutToken)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function hasInsufficientBalance(
  balance: number | string | undefined,
  priceUSD: number,
): boolean {
  if (!priceUSD || priceUSD <= 0) return false

  const balanceValue =
    typeof balance === 'string' ? parseBalance(balance) : (balance ?? 0)

  return balanceValue < priceUSD
}

/**
 * Checks if a selected coin balance is insufficient for a given price
 * @param selectedCoinBalance - The selected coin balance object with formattedBalance property
 * @param priceUSD - The required price in USD
 * @returns Object with balanceUSD and isInsufficient properties
 */
export function checkSelectedCoinBalance(
  selectedCoinBalance: { formattedBalance: string } | null | undefined,
  priceUSD: number,
): {
  balanceUSD: number
  isInsufficient: boolean
} {
  const balanceUSD = selectedCoinBalance
    ? parseBalance(selectedCoinBalance.formattedBalance)
    : 0

  const isInsufficient = Boolean(
    selectedCoinBalance &&
      priceUSD > 0 &&
      hasInsufficientBalance(balanceUSD, priceUSD),
  )

  return { balanceUSD, isInsufficient }
}
