import { describe, expect, it } from 'vitest'
import {
  getInstantMsForPremiumPrice,
  getPremiumChartYRatio,
  getPremiumInstantRange,
  getPremiumMaxChartPrice,
  getPremiumPeriodDays,
  getPremiumPriceAtInstant,
  getPremiumWindowProgress,
  type PremiumDecayConfig,
} from './premiumDecay'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const TEST_CONFIG: PremiumDecayConfig = {
  startPriceUsd: 100_000_000,
  halvingPeriodMs: MS_PER_DAY,
  periodMs: 21 * MS_PER_DAY,
}

const PREMIUM_PERIOD_MS = TEST_CONFIG.periodMs

describe('premiumDecay', () => {
  describe('getPremiumPriceAtInstant', () => {
    it('returns start price when target is before premium start', () => {
      const premiumStartMs = Date.parse('2025-01-01T00:00:00Z')
      const targetMs = premiumStartMs - 1000
      expect(
        getPremiumPriceAtInstant(premiumStartMs, targetMs, TEST_CONFIG),
      ).toBe(100_000_000 - 47.6837158203125)
    })

    it('returns 0 when target is at or after premium end', () => {
      const premiumStartMs = Date.parse('2025-01-01T00:00:00Z')
      const premiumEndMs = premiumStartMs + PREMIUM_PERIOD_MS
      expect(
        getPremiumPriceAtInstant(premiumStartMs, premiumEndMs, TEST_CONFIG),
      ).toBe(0)
    })
  })

  describe('getInstantMsForPremiumPrice', () => {
    it('is inverse of getPremiumPriceAtInstant', () => {
      const premiumStartMs = Date.parse('2025-01-01T00:00:00Z')
      const targetMs = premiumStartMs + 5 * MS_PER_DAY
      const price = getPremiumPriceAtInstant(
        premiumStartMs,
        targetMs,
        TEST_CONFIG,
      )
      const recovered = getInstantMsForPremiumPrice(
        premiumStartMs,
        price,
        TEST_CONFIG,
      )
      expect(recovered).toBeCloseTo(targetMs, -2)
    })
  })

  describe('getPremiumInstantRange', () => {
    it('returns null for zero premium', () => {
      expect(getPremiumInstantRange(0, Date.now(), TEST_CONFIG)).toBeNull()
    })

    it('returns 21-day spread', () => {
      const result = getPremiumInstantRange(50_000_000, Date.now(), TEST_CONFIG)
      expect(result).not.toBeNull()
      if (result) {
        expect(result.endMs - result.startMs).toBe(PREMIUM_PERIOD_MS)
      }
    })
  })

  describe('getPremiumPeriodDays', () => {
    it('returns 21 for test config', () => {
      expect(getPremiumPeriodDays(TEST_CONFIG)).toBe(21)
    })
  })

  describe('getPremiumWindowProgress', () => {
    it('returns 0 at start and 1 at end', () => {
      const startMs = Date.parse('2025-01-01T00:00:00Z')
      const endMs = startMs + PREMIUM_PERIOD_MS
      const range = { startMs, endMs }
      expect(getPremiumWindowProgress(range, startMs)).toBe(0)
      expect(getPremiumWindowProgress(range, endMs)).toBe(1)
    })
  })

  describe('getPremiumMaxChartPrice', () => {
    it('returns start price minus offset at t=0', () => {
      expect(getPremiumMaxChartPrice(TEST_CONFIG)).toBeCloseTo(
        100_000_000 - 47.6837158203125,
        5,
      )
    })
  })

  describe('getPremiumChartYRatio', () => {
    it('returns 0 at zero price and 1 at max chart price', () => {
      const maxPrice = getPremiumMaxChartPrice(TEST_CONFIG)
      expect(getPremiumChartYRatio(0, TEST_CONFIG)).toBe(0)
      expect(getPremiumChartYRatio(maxPrice, TEST_CONFIG)).toBe(1)
    })

    it('returns mid-curve ratio for halfway price', () => {
      const premiumStartMs = Date.parse('2025-01-01T00:00:00Z')
      const midMs = premiumStartMs + 10 * MS_PER_DAY
      const midPrice = getPremiumPriceAtInstant(
        premiumStartMs,
        midMs,
        TEST_CONFIG,
      )
      const ratio = getPremiumChartYRatio(midPrice, TEST_CONFIG)
      expect(ratio).toBeGreaterThan(0)
      expect(ratio).toBeLessThan(1)
    })
  })
})
