import { describe, expect, it } from 'vitest'
import { getLabel } from './getLabel'

describe('getLabel', () => {
  it('extracts first label from name.eth', () => {
    expect(getLabel('nick.eth')).toBe('nick')
    expect(getLabel('abc.eth')).toBe('abc')
    expect(getLabel('test.eth')).toBe('test')
  })

  it('returns name as-is when no TLD', () => {
    expect(getLabel('nick')).toBe('nick')
    expect(getLabel('abc')).toBe('abc')
  })

  it('handles subnames - extracts first label only', () => {
    expect(getLabel('sub.nick.eth')).toBe('sub')
    expect(getLabel('ab.c.eth')).toBe('ab')
  })

  it('avoids .replace edge case - something.ethereum vs something.eth', () => {
    expect(getLabel('something.ethereum')).toBe('something')
    expect(getLabel('something.eth')).toBe('something')
  })

  it('normalizes input via ens_normalize (case)', () => {
    expect(getLabel('NICK.eth')).toBe('nick')
    expect(getLabel('ABC.eth')).toBe('abc')
  })

  it('throws for invalid names', () => {
    expect(() => getLabel('')).toThrow()
    expect(() => getLabel('   ')).toThrow()
  })
})
