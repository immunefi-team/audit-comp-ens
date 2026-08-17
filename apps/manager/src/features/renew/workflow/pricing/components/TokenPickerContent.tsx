import {
  type SUPPORTED_TOKEN,
  TOKENS,
} from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { Trans } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from '@xstate/react'
import { useConnection } from 'wagmi'
import { TokenPickerContentBase } from '@/features/register-v2/workflow/pricing/components/TokenPickerContent'
import { getRenewPriceQueryOptions } from '@/features/renew/data/queries/renewPricing.query'
import { useRenewalUiContext } from '@/features/renew/state/renewalUi.context'
import { useSmartAccountContext } from '@/lib/smart-account/SmartAccountContext'
import { decimalBigintToNumber } from '@/utils/formatting/decimalBigintToNumber'

export const TokenPickerContent = () => {
  const { label, uiActor, protocol } = useRenewalUiContext()
  const account = useSmartAccountContext()
  const { isConnected: isEoaConnected } = useConnection()
  const isConnected = protocol === 'v1' ? isEoaConnected : account.isConnected
  const [duration, selectedToken] = useSelector(
    uiActor,
    (state) => [state.context.duration, state.context.selectedToken] as const,
  )

  const pricingQuery = useQuery({
    ...getRenewPriceQueryOptions(
      label,
      duration,
      selectedToken ?? TOKENS.USDC.symbol,
      protocol,
    ),
    select: (data) =>
      decimalBigintToNumber(
        data.amount,
        selectedToken ? TOKENS[selectedToken].decimals : TOKENS.USDC.decimals,
      ),
  })

  const onSelectCoin = (coin: SUPPORTED_TOKEN) => {
    uiActor.send({ type: 'pricing.token.select', token: coin })
  }

  return (
    <TokenPickerContentBase
      isConnected={isConnected}
      isLoadingBalances={account.isLoadingBalances}
      label={label}
      nextMessage={<Trans>Renew Name</Trans>}
      onNext={() => uiActor.send({ type: 'pricing.step.next' })}
      onSelectCoin={onSelectCoin}
      pricingData={pricingQuery.data}
      pricingLoading={pricingQuery.isLoading}
      selectedToken={selectedToken}
      stablecoinBalances={account.stablecoinBalances}
    />
  )
}
