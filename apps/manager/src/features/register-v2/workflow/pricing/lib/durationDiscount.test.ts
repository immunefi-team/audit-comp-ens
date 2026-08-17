import { describe, expect, it } from 'vitest'
import { getDurationDiscount } from './durationDiscount'

describe('getDurationDiscount', () => {
  it('returns 0 without valid pricing inputs', () => {
    expect(getDurationDiscount(undefined, 10, 3)).toBe(0)
    expect(getDurationDiscount(20, undefined, 3)).toBe(0)
    expect(getDurationDiscount(20, 10, 0)).toBe(0)
  })

  it('calculates a rounded discount percentage', () => {
    expect(getDurationDiscount(21, 10, 3)).toBe(30)
  })
})
