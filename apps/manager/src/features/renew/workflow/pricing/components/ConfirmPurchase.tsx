import type { Signer } from '@ens-apps/transaction-manager'
import { TOKENS } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { Trans } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from '@xstate/react'
import type { WalletClient } from 'viem'
import { ConfirmPurchaseBase } from '@/features/register-v2/workflow/pricing/components/ConfirmPurchase'
import { getRenewPriceQueryOptions } from '@/features/renew/data/queries/renewPricing.query'
import { useRenewalUiContext } from '@/features/renew/state/renewalUi.context'
import { useSmartAccountContext } from '@/lib/smart-account/SmartAccountContext'
import { decimalBigintToNumber } from '@/utils/formatting/decimalBigintToNumber'

export const ConfirmPurchase = () => {
  const { label, uiActor, protocol } = useRenewalUiContext()
  const account = useSmartAccountContext()
  const [duration, selectedToken] = useSelector(
    uiActor,
    (state) => [state.context.duration, state.context.selectedToken] as const,
  )

  const pricingQuery = useQuery({
    ...getRenewPriceQueryOptions(label, duration, selectedToken, protocol),
    select: (data) => ({
      basePriceNumber: decimalBigintToNumber(
        data.amount,
        selectedToken ? TOKENS[selectedToken].decimals : 0,
      ),
      rawPrice: data.amount,
    }),
  })

  // Renewal uses the DIRECT WALLET route: the connected EOA approves + renews
  // itself (the scoped HCA session does not permit renewal). The EOA is
  // `_msgSender()` and the rent payer.
  const ownerAddress = account.walletClient?.account?.address ?? null

  // The EOA signer that both submits and pays for the renewal.
  const renewalSigner: Signer | undefined = account.walletClient
    ? { type: 'eoa', walletClient: account.walletClient as WalletClient }
    : undefined

  return (
    <ConfirmPurchaseBase
      canNext={
        !!pricingQuery.data &&
        selectedToken !== undefined &&
        !pricingQuery.isLoading &&
        !!renewalSigner &&
        !!ownerAddress
      }
      label={label}
      nextMessage={<Trans>Renew Name</Trans>}
      onNext={() => {
        if (
          !pricingQuery.data ||
          !selectedToken ||
          !renewalSigner ||
          !ownerAddress
        ) {
          return
        }

        uiActor.send({
          type: 'renewal.start',
          label,
          signer: renewalSigner,
          ownerAddress,
          duration,
          token: selectedToken,
          priceRaw: pricingQuery.data.rawPrice,
          priceNumber: pricingQuery.data.basePriceNumber,
        })
      }}
      pricingData={pricingQuery.data?.basePriceNumber}
      selectedToken={selectedToken}
      title={<Trans>Renewing</Trans>}
    />
  )
}
