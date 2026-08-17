import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useGlobalBackButton } from '@/components/GlobalBackButton'
import { getRegistrationV2AvailabilityQueryOptions } from '../../data/queries/availability.query'
import { useRegistrationV2Context } from '../../state/registrationUi.context'
import { DurationSelector } from './components/DurationSelector'
import { PaymentCard } from './components/PaymentCard'
import { PriceCooldownBannerSection } from './components/PriceCooldownBanner'
import { PricingDomainHeader } from './components/PricingDomainHeader'
import { PricingSummaryCard } from './components/PricingSummaryCard'
import { TokenPickerDialog } from './components/TokenPickerDialog'

const useAvailabilityGuard = () => {
  const navigate = useNavigate()
  const { label } = useRegistrationV2Context()
  const availabilityQuery = useQuery({
    ...getRegistrationV2AvailabilityQueryOptions(`${label}.eth`),
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (availabilityQuery.data?.isAvailable !== false) {
      return
    }

    navigate({
      replace: true,
      to: '/$name',
      params: { name: `${label}.eth` },
    })
  }, [availabilityQuery.data?.isAvailable, label, navigate])
}

export const PricingStep = () => {
  const { label } = useRegistrationV2Context()
  useAvailabilityGuard()
  useGlobalBackButton({ isVisible: true })

  return (
    <div className="mx-auto mt-12 mb-4 w-full-[32px] max-w-6xl space-y-6.5">
      <PricingDomainHeader label={label} />
      <PriceCooldownBannerSection />

      <div className="grid grid-cols-1 gap-1.5 md:gap-2 lg:grid-cols-[2fr_420px] lg:items-stretch">
        <DurationSelector />

        <div className="flex flex-col gap-1.5 md:gap-2">
          <PricingSummaryCard />
          <PaymentCard />
        </div>
      </div>
      <TokenPickerDialog />
    </div>
  )
}
