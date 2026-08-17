import { TOKENS } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSelector } from '@xstate/react'
import type { ComponentProps } from 'react'
import { useBaseRate } from '@/features/register-v2/data/queries/baseRates.query'
import { calculateDiscount } from '@/features/register-v2/utils/discount'
import { PaymentCardBase } from '@/features/register-v2/workflow/pricing/components/PaymentCard'
import { getRenewPriceQueryOptions } from '@/features/renew/data/queries/renewPricing.query'
import { useRenewalUiContext } from '@/features/renew/state/renewalUi.context'
import { useSmartSessionGate } from '@/features/wallet/hooks/useSmartSessionGate'
import { decimalBigintToNumber } from '@/utils/formatting/decimalBigintToNumber'

type RenewalPaymentCardProps = Omit<
  ComponentProps<typeof PaymentCardBase>,
  'connectionSource' | 'type'
>

const SmartSessionPaymentCard = (props: RenewalPaymentCardProps) => {
  // V2 renewal retains the existing smart-session prerequisite.
  const { gate, sessionModal } = useSmartSessionGate()

  return (
    <>
      <PaymentCardBase
        {...props}
        connectionSource="smart-account"
        onNext={() => gate(props.onNext)}
        type="renew"
      />
      {sessionModal}
    </>
  )
}

export const PaymentCard = () => {
  const { uiActor, label, protocol } = useRenewalUiContext()

  const [duration, canNext] = useSelector(uiActor, (state) => [
    state.context.duration,
    state.can({ type: 'pricing.step.next' }),
  ])

  const baseRate = useBaseRate(label)

  const pricingQuery = useQuery({
    ...getRenewPriceQueryOptions(label, duration, TOKENS.USDC.symbol, protocol),
    select: (data) => decimalBigintToNumber(data.amount, TOKENS.USDC.decimals),
    placeholderData: keepPreviousData,
  })

  const { discountAmount } = calculateDiscount(
    pricingQuery.data ?? 0,
    baseRate,
    duration,
  )

  const openTokenPicker = () => uiActor.send({ type: 'pricing.step.next' })

  const paymentCardProps: RenewalPaymentCardProps = {
    amount: pricingQuery.data,
    canNext,
    discountAmount,
    isLoading: pricingQuery.isLoading || pricingQuery.isPlaceholderData,
    onNext: openTokenPicker,
  }

  if (protocol === 'v1') {
    return (
      <PaymentCardBase
        {...paymentCardProps}
        connectionSource="eoa"
        type="renew"
      />
    )
  }

  return <SmartSessionPaymentCard {...paymentCardProps} />
}
