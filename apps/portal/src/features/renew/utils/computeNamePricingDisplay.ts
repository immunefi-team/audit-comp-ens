import { formatUnits } from 'viem'
import type { RegistrationPriceResult } from '@/features/register/hooks/useRegistrationPrice'
import { getEffectivePricePerYearUsd } from '@/features/register/utils/effectivePricePerYear'
import {
  getRegistrationDisplayDates,
  getStartOfToday,
} from '@/features/register/utils/registrationDuration'
import {
  formatPriceDisplay,
  formatRegistrationTotal,
} from '@/features/register/utils/registrationPrice'
import { CONTRACT_SECONDS_PER_YEAR } from '@/lib/constants/duration'
import { ORACLE_PRICE_DECIMALS } from '@/lib/constants/oracle'
import { formatExpiryDate } from '@/utils/formatting/formatDateTime'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'
import { dateToPlainDate } from '@/utils/temporal'
import type { SelectedName } from '../hooks/useRenewalTransactions'

export type NamePricingDisplay = {
  /** e.g. "3 years" */
  readonly registrationPeriod: string
  /** e.g. "Mar 11, 2029" */
  readonly newExpiryFormatted: string
  /** Always "Price:" — the discount is surfaced via discountSublabel */
  readonly priceLabel: string
  /** e.g. "$650/year" — per-year only; total is shown on the Total row */
  readonly priceValue: string
  /** Small green sublabel under price, e.g. "3+ yr discount price". `undefined` when no discount. */
  readonly discountSublabel: string | undefined
  /** Formatted base price e.g. "$1,462.50" */
  readonly subtotal: string
  /** Formatted base + premium total e.g. "$1,462.50" */
  readonly total: string
  /** Raw USD amount (base only) for computing multi-name totals */
  readonly actualPrice: number
  /** Raw USD discount amount for computing multi-name total savings */
  readonly discountAmount: number
}

/**
 * Pure function — computes all display values for a single name given a fetched price.
 * Shared between single-name and multi-name renewal flows.
 *
 * @param baseRate Per-second oracle base rate (12 decimals). Used to derive the
 *   undiscounted baseline for the multi-year discount amount. Pass 0n when
 *   unavailable; discountAmount will be 0.
 */
export function computeNamePricingDisplay(
  selectedName: SelectedName,
  price: RegistrationPriceResult,
  duration: number,
  baseRate: bigint,
): NamePricingDisplay {
  const { registrationPeriod } = getRegistrationDisplayDates(duration)

  const days = Math.floor(duration / 86400)
  const baseDate = selectedName.expiryDate
    ? dateToPlainDate(selectedName.expiryDate)
    : getStartOfToday()
  const newExpiryFormatted = formatExpiryDate(baseDate.add({ days }))

  const years = duration / CONTRACT_SECONDS_PER_YEAR
  const roundedYears = Math.round(years)
  const discountSublabel =
    roundedYears >= 2 ? `${roundedYears}+ yr discount price` : undefined

  const actualPrice = Number(formatUnits(price.base, price.decimals))
  const effectivePerYear = getEffectivePricePerYearUsd({
    priceBase: price.base,
    priceDecimals: price.decimals,
    durationSeconds: duration,
    baseRate,
  })

  const undiscountedBase =
    baseRate > 0n
      ? Number(
          formatUnits(
            baseRate * BigInt(Math.round(duration)),
            ORACLE_PRICE_DECIMALS,
          ),
        )
      : 0
  const discountAmount = Math.max(undiscountedBase - actualPrice, 0)

  const priceValue =
    Math.round(years * 12) >= 12
      ? `${formatUsd(effectivePerYear)}/year`
      : formatUsd(effectivePerYear)

  return {
    registrationPeriod,
    newExpiryFormatted,
    priceLabel: 'Price:',
    priceValue,
    discountSublabel,
    subtotal: formatPriceDisplay(price.base, price.decimals),
    total: formatRegistrationTotal(price.base, price.premium, price.decimals),
    actualPrice,
    discountAmount,
  }
}
