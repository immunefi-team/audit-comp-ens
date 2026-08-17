import { describe, expect, it } from 'vitest'
import { CONTRACT_SECONDS_PER_YEAR } from '@/lib/constants/duration'
import { getEffectivePricePerYearUsd } from './effectivePricePerYear'

const USDC_DECIMALS = 6

/** Convert a USD amount to a USDC bigint (6 decimals). */
const usdc = (usd: number): bigint =>
  BigInt(Math.round(usd * 10 ** USDC_DECIMALS))

/** Per-second oracle base rate in 12 decimals from a $/year amount. */
const baseRateFromYearlyUsd = (usdPerYear: number): bigint =>
  (BigInt(usdPerYear) * 10n ** 12n) / BigInt(CONTRACT_SECONDS_PER_YEAR)

describe('getEffectivePricePerYearUsd', () => {
  describe('primary path: actualBase / years', () => {
    it('returns actualBase / years for 1 year', () => {
      const result = getEffectivePricePerYearUsd({
        priceBase: usdc(5),
        priceDecimals: USDC_DECIMALS,
        durationSeconds: CONTRACT_SECONDS_PER_YEAR,
        baseRate: 0n,
      })
      expect(result).toBeCloseTo(5, 5)
    })

    it('divides total across multi-year durations', () => {
      // $15 over 3 years → $5/year
      const result = getEffectivePricePerYearUsd({
        priceBase: usdc(15),
        priceDecimals: USDC_DECIMALS,
        durationSeconds: 3 * CONTRACT_SECONDS_PER_YEAR,
        baseRate: 0n,
      })
      expect(result).toBeCloseTo(5, 5)
    })

    it('does not apply any discount itself — purely divides actualBase by years', () => {
      // Contract pre-applies any multi-year discount; this function must not
      // re-apply or remove it. Same $/yr behaviour for any actualBase, regardless
      // of duration, as long as actualBase/years matches.
      const oneYear = getEffectivePricePerYearUsd({
        priceBase: usdc(8),
        priceDecimals: USDC_DECIMALS,
        durationSeconds: CONTRACT_SECONDS_PER_YEAR,
        baseRate: 0n,
      })
      const fiveYears = getEffectivePricePerYearUsd({
        priceBase: usdc(40), // 5 × $8 — no contract discount applied
        priceDecimals: USDC_DECIMALS,
        durationSeconds: 5 * CONTRACT_SECONDS_PER_YEAR,
        baseRate: 0n,
      })
      expect(oneYear).toBeCloseTo(8, 5)
      expect(fiveYears).toBeCloseTo(8, 5)
    })

    it('handles non-USDC decimals', () => {
      // 5 base units in 18-decimal token (e.g. an 18-decimal stablecoin) → $5
      const ethStable = (usd: number): bigint =>
        BigInt(Math.round(usd * 10 ** 18))
      const result = getEffectivePricePerYearUsd({
        priceBase: ethStable(8),
        priceDecimals: 18,
        durationSeconds: CONTRACT_SECONDS_PER_YEAR,
        baseRate: 0n,
      })
      expect(result).toBeCloseTo(8, 5)
    })

    it('ignores baseRate when actualBase is positive', () => {
      // actualBase says $5/yr; baseRate says $999/yr — should pick actualBase
      const result = getEffectivePricePerYearUsd({
        priceBase: usdc(5),
        priceDecimals: USDC_DECIMALS,
        durationSeconds: CONTRACT_SECONDS_PER_YEAR,
        baseRate: baseRateFromYearlyUsd(999),
      })
      expect(result).toBeCloseTo(5, 5)
    })
  })

  describe('fallback path: baseRate × secondsPerYear', () => {
    it('uses baseRate when actualBase is 0', () => {
      const result = getEffectivePricePerYearUsd({
        priceBase: 0n,
        priceDecimals: USDC_DECIMALS,
        durationSeconds: CONTRACT_SECONDS_PER_YEAR,
        baseRate: baseRateFromYearlyUsd(5),
      })
      // baseRate is integer-floored when built, so allow tiny rounding error
      expect(result).toBeCloseTo(5, 2)
    })

    it('returns baseRate-derived $/year regardless of duration', () => {
      // Fallback shows the undiscounted baseline — not discounted by duration
      const result = getEffectivePricePerYearUsd({
        priceBase: 0n,
        priceDecimals: USDC_DECIMALS,
        durationSeconds: 5 * CONTRACT_SECONDS_PER_YEAR,
        baseRate: baseRateFromYearlyUsd(5),
      })
      expect(result).toBeCloseTo(5, 2)
    })
  })

  describe('zero path', () => {
    it('returns 0 when both baseRate and priceBase are 0', () => {
      const result = getEffectivePricePerYearUsd({
        priceBase: 0n,
        priceDecimals: USDC_DECIMALS,
        durationSeconds: CONTRACT_SECONDS_PER_YEAR,
        baseRate: 0n,
      })
      expect(result).toBe(0)
    })

    it('returns 0 when durationSeconds is 0', () => {
      // years = 0 → primary path skipped, fallback also returns 0 if baseRate is 0
      const result = getEffectivePricePerYearUsd({
        priceBase: usdc(5),
        priceDecimals: USDC_DECIMALS,
        durationSeconds: 0,
        baseRate: 0n,
      })
      expect(result).toBe(0)
    })

    it('falls back to baseRate when durationSeconds is 0 and baseRate is set', () => {
      const result = getEffectivePricePerYearUsd({
        priceBase: usdc(5),
        priceDecimals: USDC_DECIMALS,
        durationSeconds: 0,
        baseRate: baseRateFromYearlyUsd(5),
      })
      expect(result).toBeCloseTo(5, 2)
    })
  })
})
