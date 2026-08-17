import { Trans } from '@lingui/react/macro'
import { useSelector } from '@xstate/react'
import { format } from 'date-fns'
import { useMemo } from 'react'
import { DomainCard } from '@/components/atoms/DomainCard/DomainCard'
import { LinkButton } from '@/components/ui/button'
import { useBaseRate } from '@/features/register-v2/data/queries/baseRates.query'
import { calculateDiscount } from '@/features/register-v2/utils/discount'
import { getDurationExpiryDateForDisplay } from '@/features/register-v2/utils/time'
import { DurationLabel } from '@/features/register-v2/workflow/pricing/components/DurationLabel'
import { useRenewalUiContext } from '@/features/renew/state/renewalUi.context'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'

export const RenewalDetails = () => {
  const { uiActor, label, currentExpiry } = useRenewalUiContext()
  const submissionData = useSelector(
    uiActor,
    (state) => state.context.submissionData,
  )
  const baseRate = useBaseRate(label)
  const isCompleted = useSelector(uiActor, (state) => state.matches('success'))

  const expirationDate = useMemo(() => {
    if (!currentExpiry || !submissionData?.duration) {
      return
    }

    return getDurationExpiryDateForDisplay(
      Number(submissionData.duration),
      new Date(Number(currentExpiry) * 1000),
    )
  }, [currentExpiry, submissionData?.duration])

  if (!submissionData) {
    return null
  }

  const { discountAmount, discountPercentage, basePriceWithoutDiscount } =
    calculateDiscount(
      submissionData.priceNumber,
      baseRate,
      submissionData.duration,
    )

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-16">
        <div className="w-full lg:w-1/2">
          <DomainCard
            domainName={`${submissionData.label}.eth`}
            variant="garnet"
          />
        </div>

        <div className="flex w-full flex-col gap-6 lg:w-1/2">
          <div className="flex flex-col gap-5">
            <h3 className="font-medium text-ens-blue-dark text-xl tracking-tight">
              <Trans>Renewal Details</Trans>
            </h3>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-base text-ens-gray">
                  <Trans>Renewal Period</Trans>
                </p>
                <p className="text-base text-ens-blue-dark">
                  <DurationLabel
                    duration={Number(submissionData.duration)}
                    referenceDate={new Date(Number(currentExpiry) * 1000)}
                  />
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-base text-ens-gray">
                  <Trans>Renewal Fee</Trans>
                </p>
                <p className="text-base text-ens-blue-dark">
                  {formatUsd(basePriceWithoutDiscount)}
                </p>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-base text-ens-peridot-core">
                    <Trans>Multi-year Discount ({discountPercentage}%)</Trans>
                  </p>
                  <p className="text-base text-ens-peridot-core">
                    -{formatUsd(discountAmount)}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between border-ens-gray-two border-t pt-4">
                <p className="text-base text-ens-blue-dark">
                  <Trans>Total Paid</Trans>
                </p>
                <p className="text-base text-ens-blue-dark">
                  {formatUsd(submissionData.priceNumber)}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-base text-ens-gray">
                  <Trans>Expires</Trans>
                </p>
                <p className="text-base text-ens-blue">
                  {expirationDate ? format(expirationDate, 'MMMM d, yyyy') : ''}
                </p>
              </div>
            </div>
          </div>

          {isCompleted && (
            <LinkButton
              params={{ name: `${submissionData.label}.eth` }}
              size="xl"
              to="/$name"
              variant="blue"
            >
              <Trans>Back to profile</Trans>
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  )
}
