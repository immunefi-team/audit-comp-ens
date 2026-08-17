import { describe, expect, it } from 'vitest'
import { formatUsd, formatUsdCeil } from './formatUsdCeil'

describe('formatUsd', () => {
  it('formats numbers as USD with two decimal places', () => {
    expect(formatUsd(5)).toBe('$5.00')
    expect(formatUsd(100)).toBe('$100.00')
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(1000)).toBe('$1,000.00')
  })

  it('does not round to whole dollars', () => {
    expect(formatUsd(99.93)).toBe('$99.93')
    expect(formatUsd(5.5)).toBe('$5.50')
  })

  it('returns "—" for non-finite values', () => {
    expect(formatUsd(NaN)).toBe('—')
    expect(formatUsd(Infinity)).toBe('—')
    expect(formatUsd(-Infinity)).toBe('—')
  })
})

describe('formatUsdCeil', () => {
  it('formats whole numbers as USD', () => {
    expect(formatUsdCeil('5')).toBe('$5.00')
    expect(formatUsdCeil('100')).toBe('$100.00')
    expect(formatUsdCeil('0')).toBe('$0.00')
  })

  it('rounds up fractional amounts to whole dollars', () => {
    expect(formatUsdCeil('99.93')).toBe('$100.00')
    expect(formatUsdCeil('99.01')).toBe('$100.00')
    expect(formatUsdCeil('5.1')).toBe('$6.00')
    expect(formatUsdCeil('45.001')).toBe('$46.00')
  })

  it('does not round down', () => {
    expect(formatUsdCeil('99.99')).toBe('$100.00')
    expect(formatUsdCeil('1.001')).toBe('$2.00')
  })

  it('returns "—" for invalid input', () => {
    expect(formatUsdCeil('')).toBe('—')
    expect(formatUsdCeil('abc')).toBe('—')
    expect(formatUsdCeil('NaN')).toBe('—')
    expect(formatUsdCeil('Infinity')).toBe('—')
    expect(formatUsdCeil('-Infinity')).toBe('—')
  })

  it('formats large numbers with locale grouping', () => {
    expect(formatUsdCeil('1000')).toBe('$1,000.00')
    expect(formatUsdCeil('1234567.5')).toBe('$1,234,568.00')
  })

  it('handles negative numbers', () => {
    // Math.ceil(-0.5) = -0, which formats as "-$0.00"
    expect(formatUsdCeil('-0.5')).toBe('-$0.00')
    expect(formatUsdCeil('-1.1')).toBe('-$1.00')
  })
})
