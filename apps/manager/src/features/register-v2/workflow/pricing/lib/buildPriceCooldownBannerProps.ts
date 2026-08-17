import { formatUsd } from '@/utils/formatting/formatUsdCeil'
import { SECONDS_IN_YEAR } from '../../../utils/time'
import type {
  PriceCooldownFees,
  PriceCooldownInfo,
} from '../components/PriceCooldownBanner/types'
import { formatPremiumDateTimeLocal } from './formatPremiumDateTime'
import {
  getPremiumInstantRange,
  getPremiumPeriodDays,
  type PremiumDecayConfig,
  type PremiumInstantRange,
} from './premiumDecay'

export type BuildPriceCooldownBannerInput = {
  premiumUsd: number
  /** Base registration cost per year (USD), from `getRegisterPrice` — same source as pricing UI. */
  basePricePerYearUsd: number
  premiumDecay: PremiumDecayConfig
}

export function basePricePerYearFromDurationTotal(
  basePriceUsd: number,
  durationSeconds: number,
): number {
  if (durationSeconds <= 0) return 0
  return basePriceUsd / (durationSeconds / SECONDS_IN_YEAR)
}

export type BuildPriceCooldownBannerResult = {
  show: boolean
  props: {
    /** Label-only fees; the live currentPremiumValue is layered on by the section. */
    fees: Omit<PriceCooldownFees, 'currentPremiumValue'>
    /** Label-only cooldown copy; premiumStartDate/nowPoint are runtime values. */
    cooldown: Omit<PriceCooldownInfo, 'premiumStartDate' | 'nowPoint'>
  }
  premiumRange: PremiumInstantRange | null
  premiumDecay: PremiumDecayConfig
}

export function buildPriceCooldownBannerProps({
  premiumUsd,
  basePricePerYearUsd,
  premiumDecay,
}: BuildPriceCooldownBannerInput): BuildPriceCooldownBannerResult | null {
  if (premiumUsd <= 0) return null

  const premiumRange = getPremiumInstantRange(
    premiumUsd,
    undefined,
    premiumDecay,
  )
  if (!premiumRange) return null

  const periodDays = getPremiumPeriodDays(premiumDecay)

  return {
    show: true,
    premiumRange,
    premiumDecay,
    props: {
      fees: {
        basePricePerYearLabel: `${formatUsd(basePricePerYearUsd)}/year`,
        currentPremiumLabel: formatUsd(premiumUsd),
      },
      cooldown: {
        premiumEndsAtLabel: formatPremiumDateTimeLocal(premiumRange.endMs),
        periodDays,
        timezoneLabel: getLocalTimezoneLabel(),
      },
    },
  }
}

function getLocalTimezoneLabel(): string {
  try {
    const offsetMinutes = -new Date().getTimezoneOffset()
    const sign = offsetMinutes >= 0 ? '+' : '-'
    const abs = Math.abs(offsetMinutes)
    const hours = Math.floor(abs / 60)
    const mins = abs % 60
    const offset =
      mins === 0
        ? `UTC${sign}${hours}`
        : `UTC${sign}${hours}:${String(mins).padStart(2, '0')}`
    return offset
  } catch {
    return 'UTC'
  }
}
