/**
 * Premium decay calculation utilities for the v2 StandardRentPriceOracle.
 *
 * The temporary premium follows an exponential halving decay:
 *   price(t) = startPrice * 2^(-t / halvingPeriod) - offset
 *
 * where offset ensures the curve reaches exactly 0 at the end of the premium period.
 *
 * All constants are fetched from the oracle via getOracleParamsQueryOptions.
 */

export type PremiumDecayConfig = {
  /** Starting premium price in USD. */
  readonly startPriceUsd: number
  /** Duration until the premium halves, in milliseconds. */
  readonly halvingPeriodMs: number
  /** Total premium window duration, in milliseconds. */
  readonly periodMs: number
}

/**
 * Returns the total premium period as a whole number of days.
 */
export function getPremiumPeriodDays(config: PremiumDecayConfig): number {
  return Temporal.Duration.from({ milliseconds: config.periodMs }).total('days')
}

/**
 * Computes the offset that ensures the premium curve reaches exactly 0
 * at the end of the premium period.
 *
 *   offset = startPrice * 2^(-periodMs / halvingPeriodMs)
 */
function computeOffset(config: PremiumDecayConfig): number {
  return config.startPriceUsd * 2 ** (-config.periodMs / config.halvingPeriodMs)
}

export type PremiumInstantRange = {
  start: Temporal.Instant
  end: Temporal.Instant
}

/**
 * Calculates the premium window as a pair of Temporal.Instant values.
 * Returns null if config is not yet loaded or premium is zero/negative.
 */
export function getPremiumInstantRange(
  currentPremiumUsd: number,
  now: Temporal.Instant = Temporal.Now.instant(),
  config?: PremiumDecayConfig,
): PremiumInstantRange | null {
  if (!config || currentPremiumUsd <= 0) return null

  const offset = computeOffset(config)
  // Invert: price(t) = startPrice * 2^(-t/halvingPeriod) - offset
  //   t = -halvingPeriod * log2((price + offset) / startPrice)
  const elapsedMs =
    -config.halvingPeriodMs *
    Math.log2((currentPremiumUsd + offset) / config.startPriceUsd)

  const startMs = Math.round(now.epochMilliseconds - elapsedMs)
  const endMs = startMs + config.periodMs
  return {
    start: Temporal.Instant.fromEpochMilliseconds(startMs),
    end: Temporal.Instant.fromEpochMilliseconds(endMs),
  }
}

/**
 * Derives the premium instant range from a registration price result.
 * Returns null if config is not yet loaded or the price has no premium.
 */
export function getPremiumInstantRangeFromPrice(
  price: {
    premium: bigint
    decimals: number
    hasPremium: boolean
  },
  config?: PremiumDecayConfig,
): PremiumInstantRange | null {
  if (!config || !price.hasPremium) return null

  const premiumUsd = Number(price.premium) / 10 ** price.decimals
  return getPremiumInstantRange(premiumUsd, undefined, config)
}

/**
 * Calculates the premium price at a given instant.
 * Returns 0 if config is not yet loaded.
 *
 * @param start  - When the premium period began (= name expiry).
 * @param target - The instant to calculate the price for.
 * @param config - Oracle-derived decay parameters.
 */
export function getPremiumPriceAtInstant(
  start: Temporal.Instant,
  target: Temporal.Instant,
  config?: PremiumDecayConfig,
): number {
  if (!config) return 0

  const offset = computeOffset(config)
  const elapsedMs = target.epochMilliseconds - start.epochMilliseconds
  if (elapsedMs < 0) return config.startPriceUsd - offset
  if (elapsedMs >= config.periodMs) return 0

  return Math.max(
    config.startPriceUsd * 2 ** (-elapsedMs / config.halvingPeriodMs) - offset,
    0,
  )
}
