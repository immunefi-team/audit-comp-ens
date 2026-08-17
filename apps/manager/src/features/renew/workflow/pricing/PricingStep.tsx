import { Trans } from '@lingui/react/macro'
import ensMarkBadge from '@/assets/ens-mark-badge.svg'
import { useGlobalBackButton } from '@/components/GlobalBackButton'
import { PricingDomainHeader } from '@/features/register-v2/workflow/pricing/components/PricingDomainHeader'
import { useRenewalUiContext } from '../../state/renewalUi.context'
import { RenewPageLayout } from '../components/RenewPageLayout'
import { DurationSelector } from './components/DurationSelector'
import { PaymentCard } from './components/PaymentCard'
import { PricingSummaryCard } from './components/PricingSummaryCard'
import { TokenPickerDialog } from './components/TokenPickerDialog'

export const RenewPricingStep = () => {
  const { label, protocol } = useRenewalUiContext()
  useGlobalBackButton({ isVisible: true })

  return (
    <RenewPageLayout>
      {protocol === 'v1' ? (
        <div className="flex flex-col items-center gap-3 md:items-start">
          <span className="inline-flex h-5 w-fit items-center gap-1 whitespace-nowrap rounded-full border border-ens-peridot-500 px-2 font-sans text-ens-peridot-500 text-sm leading-none tracking-wide">
            <img alt="" className="size-4 shrink-0" src={ensMarkBadge} />
            <Trans>ENSv1 only</Trans>
          </span>
          <PricingDomainHeader label={label} />
        </div>
      ) : (
        <PricingDomainHeader label={label} />
      )}

      <div className="grid grid-cols-1 gap-1.5 md:gap-2 lg:grid-cols-[2fr_420px] lg:items-stretch">
        <DurationSelector />

        <div className="flex flex-col gap-1.5 md:gap-2">
          <PricingSummaryCard />
          <PaymentCard />
        </div>
      </div>
      <TokenPickerDialog />
    </RenewPageLayout>
  )
}
