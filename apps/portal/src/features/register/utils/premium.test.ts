import { describe, expect, it } from 'vitest'
import { getPremiumLabel } from './premium'

describe('getPremiumLabel', () => {
  it('returns premium-3 label for 3-character names', () => {
    expect(getPremiumLabel('abc')).toEqual({
      label: '3 letter premium price',
      variant: 'premium-3',
    })
    expect(getPremiumLabel('abc.eth')).toEqual({
      label: '3 letter premium price',
      variant: 'premium-3',
    })
  })

  it('returns premium-4 label for 4-character names', () => {
    expect(getPremiumLabel('abcd')).toEqual({
      label: '4 letter premium price',
      variant: 'premium-4',
    })
    expect(getPremiumLabel('test.eth')).toEqual({
      label: '4 letter premium price',
      variant: 'premium-4',
    })
  })

  it('returns undefined for non-premium names', () => {
    expect(getPremiumLabel('a')).toBeUndefined()
    expect(getPremiumLabel('ab')).toBeUndefined()
    expect(getPremiumLabel('hello')).toBeUndefined()
    expect(getPremiumLabel('verylongname.eth')).toBeUndefined()
  })

  it('uses first label only - ab.c.eth has first label "ab" (2 chars)', () => {
    expect(getPremiumLabel('ab.c.eth')).toBeUndefined()
  })
})
