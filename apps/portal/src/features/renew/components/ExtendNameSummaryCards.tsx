import type { RegistrationPriceResult } from '@/features/register/hooks/useRegistrationPrice'
import { getRegistrationDisplayDates } from '@/features/register/utils/registrationDuration'
import { formatPriceDisplay } from '@/features/register/utils/registrationPrice'
import { CONTRACT_SECONDS_PER_YEAR } from '@/lib/constants/duration'
import { dateToPlainDate } from '@/utils/temporal'

type ExtendNameSummaryCardsProps = {
  readonly durationSeconds: number
  readonly price: RegistrationPriceResult
  /** The name's current expiry, used to anchor the new-expiry calc. */
  readonly baseDate?: Date
}

/**
 * Extension / new-expiry / total-cost summary cards shown in the extend (renew)
 * flow. (Formerly the shared RegistrationSummaryCards — registration now uses
 * the post-success banner instead, so this is extension-only.)
 */
export const ExtendNameSummaryCards = ({
  durationSeconds,
  price,
  baseDate,
}: ExtendNameSummaryCardsProps) => {
  const {
    registrationPeriod,
    registrationDays,
    daysUntilExpiry,
    expiresFormatted,
  } = getRegistrationDisplayDates(
    durationSeconds,
    baseDate ? dateToPlainDate(baseDate) : undefined,
  )

  // Renewal only charges `base` (the renewer's `renew` — v2 ETHRegistrar or v1
  // ETHRenewerV1) — no premium.
  const totalCost = formatPriceDisplay(price.base, price.decimals)

  const roundedYears = Math.round(durationSeconds / CONTRACT_SECONDS_PER_YEAR)
  const discountText =
    roundedYears >= 2 ? `${roundedYears}+ yr discount price` : undefined

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <p className="text-sm">Extension</p>
        <p className="text-foreground text-base font-medium mt-1">
          {registrationPeriod}
        </p>
        <p className="text-muted-foreground text-xs mt-0.5">
          {registrationDays} days
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <p className="text-sm">New expiry</p>
        <p className="text-foreground text-base font-medium mt-1">
          {expiresFormatted}
        </p>
        <p className="text-muted-foreground text-xs mt-0.5">
          in {daysUntilExpiry} days
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <p className="text-sm">Total cost</p>
        <p className="text-foreground text-base font-medium mt-1">
          {totalCost}
        </p>
        {discountText ? (
          <p className="text-success-text text-xs mt-0.5">{discountText}</p>
        ) : null}
      </div>
    </div>
  )
}
