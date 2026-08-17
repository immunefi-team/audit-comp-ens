import { describe, expect, it } from 'vitest'
import {
  durationFromDateInYears,
  durationYearsToSeconds,
  formatYears,
  MIN_REGISTER_DURATION_SECONDS,
  MIN_REGISTER_DURATION_YEARS,
  SECONDS_PER_DAY,
  SECONDS_PER_YEAR,
  sanitizePricingDuration,
} from './pricing'

describe('sanitizePricingDuration', () => {
  it('returns default duration for null/undefined/NaN', () => {
    expect(sanitizePricingDuration(null)).toBe(1)
    expect(sanitizePricingDuration(undefined)).toBe(1)
    expect(sanitizePricingDuration(Number.NaN)).toBe(1)
  })

  it('returns default duration for zero and negative values', () => {
    expect(sanitizePricingDuration(0)).toBe(1)
    expect(sanitizePricingDuration(-1)).toBe(1)
    expect(sanitizePricingDuration(-100)).toBe(1)
  })

  it('clamps small positive values to minimum duration', () => {
    expect(sanitizePricingDuration(0.001)).toBe(MIN_REGISTER_DURATION_YEARS)
  })

  it('passes through valid durations', () => {
    expect(sanitizePricingDuration(1)).toBe(1)
    expect(sanitizePricingDuration(3)).toBe(3)
    expect(sanitizePricingDuration(5)).toBe(5)
    expect(sanitizePricingDuration(10)).toBe(10)
  })

  it('passes through fractional durations', () => {
    expect(sanitizePricingDuration(2.45)).toBe(2.45)
    expect(sanitizePricingDuration(0.5)).toBe(0.5)
  })
})

describe('formatYears', () => {
  it('formats integers without decimals', () => {
    expect(formatYears(1)).toBe('1')
    expect(formatYears(3)).toBe('3')
    expect(formatYears(10)).toBe('10')
  })

  it('formats fractional years to 2 decimal places', () => {
    expect(formatYears(2.45)).toBe('2.45')
    expect(formatYears(0.5)).toBe('0.5')
    expect(formatYears(1.1)).toBe('1.1')
  })

  it('strips trailing zeros', () => {
    expect(formatYears(2.1)).toBe('2.1')
    expect(formatYears(2.1)).not.toBe('2.10')
  })

  it('handles non-finite values', () => {
    expect(formatYears(Number.POSITIVE_INFINITY)).toBe('0')
    expect(formatYears(Number.NEGATIVE_INFINITY)).toBe('0')
    expect(formatYears(Number.NaN)).toBe('0')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatYears(1.999)).toBe('2')
    expect(formatYears(2.456)).toBe('2.46')
    expect(formatYears(0.07671232876712328)).toBe('0.08')
  })
})

describe('durationFromDateInYears', () => {
  const baseDate = new Date('2025-01-01T12:00:00Z')

  it('calculates 1 year correctly', () => {
    const target = new Date('2026-01-01T12:00:00Z')
    const result = durationFromDateInYears(target, baseDate)
    expect(result).toBeCloseTo(365 / 365, 5)
  })

  it('calculates fractional years from day-level differences', () => {
    const target = new Date('2025-07-01T12:00:00Z') // ~181 days
    const result = durationFromDateInYears(target, baseDate)
    expect(result).toBeCloseTo(181 / 365, 2)
  })

  it('returns minimum duration for past dates', () => {
    const target = new Date('2024-01-01T12:00:00Z')
    expect(durationFromDateInYears(target, baseDate)).toBe(
      MIN_REGISTER_DURATION_YEARS,
    )
  })

  it('returns minimum duration for same-day dates', () => {
    const target = new Date('2025-01-01T18:00:00Z')
    expect(durationFromDateInYears(target, baseDate)).toBe(
      MIN_REGISTER_DURATION_YEARS,
    )
  })

  it('returns minimum duration for dates less than 28 days out', () => {
    const target = new Date('2025-01-20T12:00:00Z') // 19 days
    const result = durationFromDateInYears(target, baseDate)
    expect(result).toBe(MIN_REGISTER_DURATION_YEARS)
  })

  it('normalizes hours to zero for day-level precision', () => {
    const target1 = new Date(2026, 5, 15, 0, 0, 0)
    const target2 = new Date(2026, 5, 15, 23, 59, 59)
    const now = new Date(2025, 0, 1, 12, 0, 0)
    expect(durationFromDateInYears(target1, now)).toBe(
      durationFromDateInYears(target2, now),
    )
  })
})

describe('durationYearsToSeconds', () => {
  it('converts 1 year to seconds', () => {
    expect(durationYearsToSeconds(1)).toBe(BigInt(SECONDS_PER_YEAR))
  })

  it('converts fractional years', () => {
    const result = durationYearsToSeconds(0.5)
    const expected = BigInt(Math.round(0.5 * SECONDS_PER_YEAR))
    expect(result).toBe(expected)
  })

  it('returns minimum for zero, negative, and non-finite values', () => {
    const min = BigInt(MIN_REGISTER_DURATION_SECONDS)
    expect(durationYearsToSeconds(0)).toBe(min)
    expect(durationYearsToSeconds(-1)).toBe(min)
    expect(durationYearsToSeconds(Number.NaN)).toBe(min)
    expect(durationYearsToSeconds(Number.POSITIVE_INFINITY)).toBe(min)
  })

  it('clamps very small durations to minimum seconds', () => {
    expect(durationYearsToSeconds(0.001)).toBe(
      BigInt(MIN_REGISTER_DURATION_SECONDS),
    )
  })

  it('handles large durations', () => {
    const result = durationYearsToSeconds(100)
    expect(result).toBe(BigInt(100 * SECONDS_PER_YEAR))
  })
})

describe('constants', () => {
  it('SECONDS_PER_DAY is 86400', () => {
    expect(SECONDS_PER_DAY).toBe(86400)
  })

  it('SECONDS_PER_YEAR is 365 days', () => {
    expect(SECONDS_PER_YEAR).toBe(365 * 86400)
  })

  it('MIN_REGISTER_DURATION_SECONDS is 28 days', () => {
    expect(MIN_REGISTER_DURATION_SECONDS).toBe(28 * 86400)
  })

  it('MIN_REGISTER_DURATION_YEARS is consistent', () => {
    expect(MIN_REGISTER_DURATION_YEARS).toBeCloseTo(28 / 365, 5)
  })
})
