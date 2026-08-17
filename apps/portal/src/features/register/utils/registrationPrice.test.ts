import { describe, expect, it } from 'vitest'
import { DAI_DECIMALS, USDC_DECIMALS } from '@/lib/constants/tokens'
import {
  formatPriceDisplay,
  formatPriceExact,
  formatRegistrationTotal,
  getSavingsPct,
  isPriceResult,
} from './registrationPrice'

describe('formatPriceExact', () => {
  it('preserves full precision without rounding to cents', () => {
    expect(formatPriceExact(1_451_913_456n, USDC_DECIMALS)).toBe(
      '$1,451.913456',
    )
  })

  it('groups thousands and omits the fraction when whole', () => {
    expect(formatPriceExact(50_000_000n, USDC_DECIMALS)).toBe('$50')
    expect(formatPriceExact(100_000_000_000_000n, USDC_DECIMALS)).toBe(
      '$100,000,000',
    )
    expect(formatPriceExact(0n, USDC_DECIMALS)).toBe('$0')
  })
})

const validPriceResult = {
  base: 5_000_000n,
  premium: 0n,
  total: 5_000_000n,
  decimals: USDC_DECIMALS,
  hasPremium: false,
}

describe('isPriceResult', () => {
  it('returns true for valid RegistrationPriceResult', () => {
    expect(isPriceResult(validPriceResult)).toBe(true)
  })

  it('returns true for object with extra fields', () => {
    expect(isPriceResult({ ...validPriceResult, extra: 'ignored' })).toBe(true)
  })

  it('returns false for null', () => {
    expect(isPriceResult(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isPriceResult(undefined)).toBe(false)
  })

  it('returns false for primitives', () => {
    expect(isPriceResult('string')).toBe(false)
    expect(isPriceResult(123)).toBe(false)
    expect(isPriceResult(true)).toBe(false)
  })

  it('returns false when base is missing', () => {
    const { base: _, ...withoutBase } = validPriceResult
    expect(isPriceResult(withoutBase)).toBe(false)
  })

  it('returns false when total is missing', () => {
    const { total: _, ...withoutTotal } = validPriceResult
    expect(isPriceResult(withoutTotal)).toBe(false)
  })

  it('returns false when decimals is missing', () => {
    const { decimals: _, ...withoutDecimals } = validPriceResult
    expect(isPriceResult(withoutDecimals)).toBe(false)
  })

  it('returns false when hasPremium is missing', () => {
    const { hasPremium: _, ...withoutHasPremium } = validPriceResult
    expect(isPriceResult(withoutHasPremium)).toBe(false)
  })

  it('returns false when total is wrong type (string instead of bigint)', () => {
    expect(isPriceResult({ ...validPriceResult, total: '5000000' })).toBe(false)
  })

  it('returns false when base is wrong type', () => {
    expect(isPriceResult({ ...validPriceResult, base: 5 })).toBe(false)
  })

  it('returns false when premium is wrong type', () => {
    expect(isPriceResult({ ...validPriceResult, premium: '0' })).toBe(false)
  })

  it('returns false when decimals is wrong type', () => {
    expect(isPriceResult({ ...validPriceResult, decimals: '6' })).toBe(false)
  })

  it('returns false when hasPremium is wrong type', () => {
    expect(isPriceResult({ ...validPriceResult, hasPremium: 'false' })).toBe(
      false,
    )
  })
})

describe('formatRegistrationTotal', () => {
  it('formats base + premium as USD total', () => {
    const base = 5_000_000n // 5 USDC
    const premium = 0n
    const result = formatRegistrationTotal(base, premium)
    expect(result).toBe('$5.00')
  })

  it('formats fractional amounts without rounding to whole dollars', () => {
    const base = 3_840_001_000n // 3840.001 USDC
    const premium = 0n
    const result = formatRegistrationTotal(base, premium)
    expect(result).toBe('$3,840.00')
  })

  it('preserves cents in the total', () => {
    const base = 47_160_000n // 47.16 USDC
    const premium = 0n
    const result = formatRegistrationTotal(base, premium)
    expect(result).toBe('$47.16')
  })

  it('uses default decimals (USDC) when not specified', () => {
    const base = 10_000_000n
    const premium = 0n
    const result = formatRegistrationTotal(base, premium)
    expect(result).toBe('$10.00')
  })

  it('accepts custom decimals for DAI', () => {
    const base = 5_000_000_000_000_000_000n // 5 DAI
    const premium = 0n
    const result = formatRegistrationTotal(base, premium, DAI_DECIMALS)
    expect(result).toBe('$5.00')
  })

  it('handles base and premium', () => {
    const base = 5_000_000n
    const premium = 0n
    const result = formatRegistrationTotal(base, premium)
    expect(result).toBe('$5.00')
  })

  it('handles zero base and premium', () => {
    const result = formatRegistrationTotal(0n, 0n)
    expect(result).toBe('$0.00')
  })
})

describe('formatPriceDisplay', () => {
  it('formats raw amount with given decimals', () => {
    expect(formatPriceDisplay(5_000_000n, 6)).toBe('$5.00')
    expect(formatPriceDisplay(5_000_000_000_000_000_000n, 18)).toBe('$5.00')
  })
})

describe('getSavingsPct', () => {
  it('returns the whole-percent saving vs the baseline', () => {
    expect(getSavingsPct(5.5, 8)).toBe(31) // round((1 - 5.5/8) * 100)
    expect(getSavingsPct(7, 8)).toBe(13)
    expect(getSavingsPct(4, 8)).toBe(50)
  })

  it('returns 0 at the baseline and a negative when above it', () => {
    // Both call sites only render the value when > 0, so a "more expensive
    // than baseline" case passes through negative rather than clamping.
    expect(getSavingsPct(8, 8)).toBe(0)
    expect(getSavingsPct(10, 8)).toBe(-25)
  })

  it('returns 0 when inputs are missing/zero', () => {
    expect(getSavingsPct(0, 8)).toBe(0)
    expect(getSavingsPct(5, 0)).toBe(0)
    expect(getSavingsPct(-1, 8)).toBe(0)
  })

  it('rounds to the nearest whole percent', () => {
    // 1 - 6.7/8 = 0.1625 -> 16.25% -> 16
    expect(getSavingsPct(6.7, 8)).toBe(16)
    // 1 - 6.6/8 = 0.175 -> 17.5% -> 18
    expect(getSavingsPct(6.6, 8)).toBe(18)
  })
})
