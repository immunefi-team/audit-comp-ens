/**
 * Premium decay calculation utilities for the v2 StandardRentPriceOracle.
 *
 * The temporary premium follows an exponential halving decay:
 *   price(t) = startPrice * 2^(-t / halvingPeriod) - offset
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type PremiumDecayConfig = {
  readonly startPriceUsd: number
  readonly halvingPeriodMs: number
  readonly periodMs: number
}

export function getPremiumPeriodDays(config: PremiumDecayConfig): number {
  return Math.round(config.periodMs / MS_PER_DAY)
}

function computeOffset(config: PremiumDecayConfig): number {
  return config.startPriceUsd * 2 ** (-config.periodMs / config.halvingPeriodMs)
}

export type PremiumInstantRange = {
  startMs: number
  endMs: number
}

export function getPremiumInstantRange(
  currentPremiumUsd: number,
  nowMs: number = Date.now(),
  config?: PremiumDecayConfig,
): PremiumInstantRange | null {
  if (!config || currentPremiumUsd <= 0) return null

  const offset = computeOffset(config)
  const elapsedMs =
    -config.halvingPeriodMs *
    Math.log2((currentPremiumUsd + offset) / config.startPriceUsd)

  const startMs = Math.round(nowMs - elapsedMs)
  const endMs = startMs + config.periodMs
  return { startMs, endMs }
}

export function getPremiumPriceAtInstant(
  startMs: number,
  targetMs: number,
  config?: PremiumDecayConfig,
): number {
  if (!config) return 0

  const offset = computeOffset(config)
  const elapsedMs = targetMs - startMs
  if (elapsedMs < 0) return config.startPriceUsd - offset
  if (elapsedMs >= config.periodMs) return 0

  return Math.max(
    config.startPriceUsd * 2 ** (-elapsedMs / config.halvingPeriodMs) - offset,
    0,
  )
}

export function getInstantMsForPremiumPrice(
  startMs: number,
  targetPrice: number,
  config: PremiumDecayConfig,
): number {
  const offset = computeOffset(config)
  const endMs = startMs + config.periodMs

  if (targetPrice >= config.startPriceUsd - offset) {
    return startMs
  }
  if (targetPrice <= 0) {
    return endMs
  }

  const elapsedMs =
    -config.halvingPeriodMs *
    Math.log2((targetPrice + offset) / config.startPriceUsd)
  const dateMs = startMs + elapsedMs
  return Math.round(Math.max(startMs, Math.min(dateMs, endMs)))
}

export function getPremiumWindowProgress(
  range: PremiumInstantRange,
  nowMs: number = Date.now(),
): number {
  const span = range.endMs - range.startMs
  if (span <= 0) return 0
  const elapsed = nowMs - range.startMs
  return Math.max(0, Math.min(1, elapsed / span))
}

/** Maximum price shown on the decay chart Y-axis (price at t=0). */
export function getPremiumMaxChartPrice(config: PremiumDecayConfig): number {
  return config.startPriceUsd - computeOffset(config)
}

/** Normalized Y position for chart rendering: 0 = bottom ($0), 1 = top (max). */
export function getPremiumChartYRatio(
  price: number,
  config: PremiumDecayConfig,
): number {
  const maxPrice = getPremiumMaxChartPrice(config)
  if (maxPrice <= 0) return 0
  return Math.max(0, Math.min(1, price / maxPrice))
}
