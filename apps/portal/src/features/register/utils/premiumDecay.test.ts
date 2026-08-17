import { describe, expect, it } from 'vitest'
import {
  getPremiumInstantRange,
  getPremiumInstantRangeFromPrice,
  getPremiumPeriodDays,
  getPremiumPriceAtInstant,
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
      const premiumStart = Temporal.Instant.from('2025-01-01T00:00:00Z')
      const target = Temporal.Instant.fromEpochMilliseconds(
        premiumStart.epochMilliseconds - 1000,
      )
      expect(getPremiumPriceAtInstant(premiumStart, target, TEST_CONFIG)).toBe(
        100_000_000 - 47.6837158203125,
      )
    })

    it('returns 0 when target is at or after premium end', () => {
      const premiumStart = Temporal.Instant.from('2025-01-01T00:00:00Z')
      const premiumEnd = Temporal.Instant.fromEpochMilliseconds(
        premiumStart.epochMilliseconds + PREMIUM_PERIOD_MS,
      )
      expect(
        getPremiumPriceAtInstant(premiumStart, premiumEnd, TEST_CONFIG),
      ).toBe(0)
      expect(
        getPremiumPriceAtInstant(
          premiumStart,
          Temporal.Instant.fromEpochMilliseconds(
            premiumEnd.epochMilliseconds + 1000,
          ),
          TEST_CONFIG,
        ),
      ).toBe(0)
    })

    it('reduces price after one day', () => {
      const premiumStart = Temporal.Instant.from('2025-01-01T00:00:00Z')
      const oneDayLater = Temporal.Instant.fromEpochMilliseconds(
        premiumStart.epochMilliseconds + MS_PER_DAY,
      )
      const price = getPremiumPriceAtInstant(
        premiumStart,
        oneDayLater,
        TEST_CONFIG,
      )
      const startPrice = getPremiumPriceAtInstant(
        premiumStart,
        premiumStart,
        TEST_CONFIG,
      )
      expect(price).toBeLessThan(startPrice)
      expect(price).toBeGreaterThan(0)
    })

    it('returns decreasing price as time progresses', () => {
      const premiumStart = Temporal.Instant.from('2025-01-01T00:00:00Z')
      const startPrice = getPremiumPriceAtInstant(
        premiumStart,
        premiumStart,
        TEST_CONFIG,
      )
      const day1 = getPremiumPriceAtInstant(
        premiumStart,
        Temporal.Instant.fromEpochMilliseconds(
          premiumStart.epochMilliseconds + MS_PER_DAY,
        ),
        TEST_CONFIG,
      )
      const day10 = getPremiumPriceAtInstant(
        premiumStart,
        Temporal.Instant.fromEpochMilliseconds(
          premiumStart.epochMilliseconds + 10 * MS_PER_DAY,
        ),
        TEST_CONFIG,
      )
      expect(day1).toBeLessThan(startPrice)
      expect(day10).toBeLessThan(day1)
    })

    it('returns 0 when config is not loaded', () => {
      const premiumStart = Temporal.Instant.from('2025-01-01T00:00:00Z')
      expect(getPremiumPriceAtInstant(premiumStart, premiumStart)).toBe(0)
    })
  })

  describe('getPremiumInstantRange', () => {
    it('returns null for zero or negative premium', () => {
      expect(getPremiumInstantRange(0, undefined, TEST_CONFIG)).toBeNull()
      expect(getPremiumInstantRange(-1, undefined, TEST_CONFIG)).toBeNull()
    })

    it('returns null when config is not loaded', () => {
      expect(getPremiumInstantRange(50_000_000)).toBeNull()
    })

    it('returns start and end instants with 21-day spread', () => {
      const result = getPremiumInstantRange(50_000_000, undefined, TEST_CONFIG)
      expect(result).not.toBeNull()
      if (result) {
        expect(
          result.end.epochMilliseconds - result.start.epochMilliseconds,
        ).toBe(PREMIUM_PERIOD_MS)
      }
    })

    it('premium end is 21 days after premium start', () => {
      const result = getPremiumInstantRange(1_000_000, undefined, TEST_CONFIG)
      expect(result).not.toBeNull()
      if (result) {
        const diff =
          result.end.epochMilliseconds - result.start.epochMilliseconds
        expect(diff).toBe(PREMIUM_PERIOD_MS)
      }
    })
  })

  describe('getPremiumPeriodDays', () => {
    it('returns whole days for an exact multiple', () => {
      expect(getPremiumPeriodDays(TEST_CONFIG)).toBe(21)
    })

    it('reflects the configured period, not a hardcoded value', () => {
      const config: PremiumDecayConfig = {
        ...TEST_CONFIG,
        periodMs: 28 * MS_PER_DAY,
      }
      expect(getPremiumPeriodDays(config)).toBe(28)
    })
  })

  describe('getPremiumInstantRangeFromPrice', () => {
    it('returns null when hasPremium is false', () => {
      expect(
        getPremiumInstantRangeFromPrice(
          {
            premium: 1000000n,
            decimals: 6,
            hasPremium: false,
          },
          TEST_CONFIG,
        ),
      ).toBeNull()
    })

    it('returns null when config is not loaded', () => {
      expect(
        getPremiumInstantRangeFromPrice({
          premium: 50_000_000_000_000n,
          decimals: 6,
          hasPremium: true,
        }),
      ).toBeNull()
    })

    it('converts premium from token units to USD and returns instant range', () => {
      const result = getPremiumInstantRangeFromPrice(
        {
          premium: 50_000_000_000_000n,
          decimals: 6,
          hasPremium: true,
        },
        TEST_CONFIG,
      )
      expect(result).not.toBeNull()
      if (result) {
        expect(result.start).toBeInstanceOf(Temporal.Instant)
        expect(result.end).toBeInstanceOf(Temporal.Instant)
        expect(
          result.end.epochMilliseconds - result.start.epochMilliseconds,
        ).toBe(PREMIUM_PERIOD_MS)
      }
    })
  })
})
