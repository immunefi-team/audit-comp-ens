import type { SUPPORTED_TOKEN } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { Trans, useLingui } from '@lingui/react/macro'
import { USDCIcon } from '@/components/atoms/StableCoinsIcons'
import { STABLECOINS } from '@/features/shared/registration/nameUtils'
import type { StablecoinBalance } from '@/lib/smart-account'
import { cn } from '@/lib/utils'
import { decimalBigintToNumber } from '@/utils/formatting/decimalBigintToNumber'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'
import { hasInsufficientBalance } from '@/utils/payment'

export const TokenListItem = ({
  stablecoin,
  selectedCoin,
  priceUSD,
  onSelectCoin,
}: {
  stablecoin: StablecoinBalance
  selectedCoin: SUPPORTED_TOKEN | undefined
  priceUSD: number
  onSelectCoin: (coin: SUPPORTED_TOKEN) => void
}) => {
  const { t } = useLingui()
  const isSelected = selectedCoin === stablecoin.symbol
  const coinConfig = STABLECOINS[stablecoin.symbol as keyof typeof STABLECOINS]
  const IconComponent = coinConfig?.icon || USDCIcon

  const coinBalanceUSD = decimalBigintToNumber(
    BigInt(stablecoin.balance),
    stablecoin.decimals,
  )
  const hasInsufficientBalanceForCoin =
    priceUSD > 0 && hasInsufficientBalance(coinBalanceUSD, priceUSD)

  return (
    <button
      aria-label={t`Select ${stablecoin.symbol}`}
      className={cn(
        'flex h-11 items-center justify-between rounded px-3 py-4 transition-colors',
        isSelected ? 'bg-ens-quartz-75' : 'hover:bg-ens-quartz-50',
        hasInsufficientBalanceForCoin && 'cursor-not-allowed opacity-50',
      )}
      disabled={hasInsufficientBalanceForCoin}
      onClick={() => onSelectCoin(stablecoin.symbol as SUPPORTED_TOKEN)}
      type="button"
    >
      <div className="flex items-center gap-2">
        <div className="relative h-8 w-8">
          <IconComponent className="h-8 w-8" />
          <div className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ens-peridot-core">
            <span className="text-[0.5rem] text-white leading-none">S</span>
          </div>
        </div>
        <p className="text-ens-gray-dark text-sm tracking-wide">
          {stablecoin.symbol}
        </p>
      </div>
      <div className="flex flex-col items-end">
        <div className="flex items-baseline gap-1.5">
          <p
            className={cn(
              'text-right text-base tracking-wide',
              hasInsufficientBalanceForCoin
                ? 'text-ens-error'
                : 'text-ens-gray-dark',
            )}
          >
            {formatUsd(coinBalanceUSD)}
          </p>
          <span className="text-[#A0A4A6] text-sm">
            <Trans>available</Trans>
          </span>
        </div>
        {hasInsufficientBalanceForCoin && priceUSD > 0 && (
          <p className="text-ens-error text-xs">
            <Trans>Need {formatUsd(priceUSD)}</Trans>
          </p>
        )}
      </div>
    </button>
  )
}
