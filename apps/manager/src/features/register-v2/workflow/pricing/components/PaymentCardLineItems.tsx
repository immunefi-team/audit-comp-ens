import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { type MaterialSymbol, MSymbol } from '@/components/ui/material-symbol'
import { tw } from '@/utils/tailwind'
import { AnimatedPrice } from './AnimatedPrice'

type PaymentCardLineItemProps = {
  label: ReactNode
  amount: number
  isLoading: boolean
  symbol: MaterialSymbol
  showPlus?: boolean
}

const PaymentCardLineItem = ({
  label,
  amount,
  isLoading,
  symbol,
  showPlus = false,
}: PaymentCardLineItemProps) => (
  <div
    className={tw(
      'flex w-full items-center justify-between gap-2 text-ens-lapis-500 text-sm',
      isLoading && 'animate-pulse',
    )}
  >
    <div className="flex items-center gap-2">
      <MSymbol className="ms-opsz-16 ms-wght-400" symbol={symbol} />
      <span>{label}</span>
    </div>
    <span className="tabular-nums">
      {showPlus && '+ '}
      <AnimatedPrice value={amount} />
    </span>
  </div>
)

export const PaymentCardPremiumLine = ({
  premiumAmount,
  isLoading,
}: {
  premiumAmount: number
  isLoading: boolean
}) => (
  <PaymentCardLineItem
    amount={premiumAmount}
    isLoading={isLoading}
    label={<Trans>Cooldown fee</Trans>}
    showPlus
    symbol="hourglass"
  />
)

export const PaymentCardBaseLine = ({
  basePrice,
  isLoading,
}: {
  basePrice: number
  isLoading: boolean
}) => (
  <PaymentCardLineItem
    amount={basePrice}
    isLoading={isLoading}
    label={<Trans>Registration</Trans>}
    symbol="receipt_long"
  />
)
