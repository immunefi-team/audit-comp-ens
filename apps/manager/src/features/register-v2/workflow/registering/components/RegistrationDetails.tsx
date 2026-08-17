import { Trans } from '@lingui/react/macro'
import { format } from 'date-fns'
import { useMemo } from 'react'
import { DomainCard } from '@/components/atoms/DomainCard/DomainCard'
import { LinkButton } from '@/components/ui/button'
import { MSymbol } from '@/components/ui/material-symbol'
import { calculateDiscount } from '@/features/register-v2/utils/discount'
import {
  getDurationExpiryDateForDisplay,
  getStartOfDay,
} from '@/features/register-v2/utils/time'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'
import { useBaseRate } from '../../../data/queries/baseRates.query'
import { RegisterV2Context } from '../../../state/registrationUi.context'
import { DurationLabel } from '../../pricing/components/DurationLabel'

const useDetails = RegisterV2Context.createSelector(
  (state) => state.context.confirmedData,
)

/** Top-level `success` (post-registering step) */
const useIsTopLevelSuccess = RegisterV2Context.createSelector((state) =>
  state.matches('success'),
)

const useIsRegisteringTransactionSuccess = RegisterV2Context.createSelector(
  (state) => state.matches({ registering: { transaction: 'success' } }),
)

export const RegistrationDetails = () => {
  const { uiActor, label } = RegisterV2Context.use()
  const details = useDetails(uiActor)
  const topSuccess = useIsTopLevelSuccess(uiActor)
  const registeringTxSuccess = useIsRegisteringTransactionSuccess(uiActor)
  const showCompleteProfileCta = topSuccess || registeringTxSuccess
  const baseRate = useBaseRate(label)

  const expirationDate = useMemo(
    () =>
      getDurationExpiryDateForDisplay(
        Number(details?.duration ?? 0n),
        getStartOfDay(),
      ),
    [details?.duration],
  )

  if (!details) {
    return null
  }

  const { discountAmount, discountPercentage, basePriceWithoutDiscount } =
    calculateDiscount(details.basePriceNumber, baseRate, details.duration)

  const totalPrice =
    basePriceWithoutDiscount + details.premiumPriceNumber - discountAmount

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-16">
        <div className="w-full lg:w-1/2">
          <DomainCard domainName={`${details.label}.eth`} variant="garnet" />
        </div>

        <div className="flex w-full flex-col gap-6 lg:w-1/2">
          <div className="flex flex-col gap-5">
            <h3 className="font-medium text-ens-blue-dark text-xl tracking-tight">
              <Trans>Registration Details</Trans>
            </h3>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-base text-ens-gray">
                  <Trans>Registration Period</Trans>
                </p>
                <p className="text-base text-ens-blue-dark">
                  <DurationLabel
                    duration={Number(details.duration)}
                    referenceDate={getStartOfDay()}
                  />
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-base text-ens-gray">
                  <Trans>Registration Fee</Trans>
                </p>
                <p className="text-base text-ens-blue-dark">
                  {formatUsd(basePriceWithoutDiscount)}
                </p>
              </div>

              {details.premiumPriceNumber > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-ens-lapis-500">
                    <MSymbol
                      className="ms-opsz-16 ms-wght-400"
                      symbol="hourglass"
                    />
                    <p className="text-base">
                      <Trans>Price cooldown fee</Trans>
                    </p>
                  </div>
                  <p className="text-base text-ens-lapis-500 tabular-nums">
                    +{formatUsd(details.premiumPriceNumber)}
                  </p>
                </div>
              )}

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
                  {formatUsd(totalPrice)}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-base text-ens-gray">
                  <Trans>Expires</Trans>
                </p>
                <p className="text-base text-ens-blue">
                  {format(expirationDate, 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>

          {showCompleteProfileCta && (
            <LinkButton
              params={{ name: `${details.label}.eth` }}
              size="xl"
              to="/$name"
              variant="blue"
            >
              <Trans>Complete your profile</Trans>
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  )
}
