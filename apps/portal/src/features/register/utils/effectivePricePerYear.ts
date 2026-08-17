import { formatUnits } from 'viem'
import { CONTRACT_SECONDS_PER_YEAR } from '@/lib/constants/duration'
import { ORACLE_PRICE_DECIMALS } from '@/lib/constants/oracle'

type EffectivePricePerYearInput = {
  /** Actual base price charged by the contract, in token units. */
  readonly priceBase: bigint
  /** Token decimals for `priceBase` (e.g. 6 for USDC). */
  readonly priceDecimals: number
  /** Registration duration in seconds. */
  readonly durationSeconds: number
  /**
   * Oracle's per-second base rate (12-decimal units). Used as a fallback when
   * the contract price hasn't loaded so the row doesn't flash empty. Pass `0n`
   * to disable the fallback.
   */
  readonly baseRate: bigint
}

/**
 * Effective per-year price in USD, derived from on-chain data.
 *
 * Primary: `actualBase / years`.
 * Fallback (while rentPrice is in-flight): `baseRate × secondsPerYear`.
 * Returns 0 when neither input is available.
 */
export function getEffectivePricePerYearUsd({
  priceBase,
  priceDecimals,
  durationSeconds,
  baseRate,
}: EffectivePricePerYearInput): number {
  const years = durationSeconds / CONTRACT_SECONDS_PER_YEAR
  const actualBaseUsd = Number(formatUnits(priceBase, priceDecimals))

  if (years > 0 && actualBaseUsd > 0) {
    return actualBaseUsd / years
  }

  if (baseRate > 0n) {
    return Number(
      formatUnits(
        baseRate * BigInt(CONTRACT_SECONDS_PER_YEAR),
        ORACLE_PRICE_DECIMALS,
      ),
    )
  }

  return 0
}
