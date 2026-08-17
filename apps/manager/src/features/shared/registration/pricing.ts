import type {
  PricingDuration,
  PricingOptions,
  PricingQuoteMap,
} from './pricingTypes'

export const PRICING_DURATIONS: PricingDuration[] = [1, 3, 5, 10]
export const SECONDS_PER_DAY = 86400
export const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY
export const MIN_REGISTER_DURATION_SECONDS = 2419200
export const MIN_REGISTER_DURATION_YEARS =
  MIN_REGISTER_DURATION_SECONDS / SECONDS_PER_YEAR

export const PRICING_YEAR_DISCOUNTS: Record<PricingDuration, number> = {
  1: 0,
  3: 0,
  5: 0,
  10: 0,
}

export const INITIAL_PRICING_OPTIONS: PricingOptions = {
  1: {
    price: 0,
    discount: PRICING_YEAR_DISCOUNTS[1],
    label: '1 year',
    total: 0,
  },
  3: {
    price: 0,
    discount: PRICING_YEAR_DISCOUNTS[3],
    label: '3 years',
    total: 0,
  },
  5: {
    price: 0,
    discount: PRICING_YEAR_DISCOUNTS[5],
    label: '5 years',
    total: 0,
  },
  10: {
    price: 0,
    discount: PRICING_YEAR_DISCOUNTS[10],
    label: '10 years',
    total: 0,
  },
}

export function sanitizePricingDuration(
  value: number | undefined | null,
): number {
  const defaultDuration = 1

  if (value == null || Number.isNaN(value)) return defaultDuration

  if (value <= 0) return defaultDuration

  return Math.max(MIN_REGISTER_DURATION_YEARS, value)
}

export const createEmptyPricingQuoteMap = (): PricingQuoteMap => ({
  1: {},
  3: {},
  5: {},
  10: {},
})

export const formatDuration = (duration: number): string => {
  return formatYears(duration)
}

export const calculateExpirationDate = (years: number): Date => {
  return new Date(Date.now() + years * SECONDS_PER_YEAR * 1000)
}

export const formatExpirationDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Calculates the duration in years from today to a target date using calendar-day precision.
 * @param targetDate - The target expiration date
 * @returns The duration in years (minimum 28 days)
 */
export const calculateDurationFromDate = (targetDate: Date): number => {
  return durationFromDateInYears(targetDate)
}

export const durationFromDateInYears = (
  targetDate: Date,
  now: Date = new Date(),
): number => {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)

  const diffMs = Math.max(0, target.getTime() - today.getTime())
  const diffDays = diffMs / (SECONDS_PER_DAY * 1000)
  const diffYears = diffDays / 365

  return Math.max(MIN_REGISTER_DURATION_YEARS, diffYears)
}

export const durationYearsToSeconds = (durationYears: number): bigint => {
  if (!Number.isFinite(durationYears) || durationYears <= 0) {
    return BigInt(MIN_REGISTER_DURATION_SECONDS)
  }

  const clampedYears = Math.max(MIN_REGISTER_DURATION_YEARS, durationYears)
  const seconds = Math.round(clampedYears * SECONDS_PER_YEAR)

  return BigInt(Math.max(MIN_REGISTER_DURATION_SECONDS, seconds))
}

export const formatYears = (years: number): string => {
  if (!Number.isFinite(years)) return '0'

  if (Number.isInteger(years)) return years.toString()

  return Number(years.toFixed(2)).toString()
}
