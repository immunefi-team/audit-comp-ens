import { describe, expect, it } from 'vitest'
import { truncateName } from './truncateName'

describe('truncateName', () => {
  it('should not truncate names within maxLength', () => {
    expect(truncateName('vitalik.eth')).toBe('vitalik.eth')
  })

  it('should not truncate names exactly at maxLength', () => {
    const name = `${'a'.repeat(20)}.eth` // 24 chars
    expect(truncateName(name)).toBe(name)
  })

  it('should truncate long names preserving the TLD', () => {
    const result = truncateName('quasar-mist-silver-locked-resolver-locked.eth')
    expect(result).toMatch(/^quasar-mis….*\.eth$/)
    expect(result.length).toBeLessThanOrEqual(24)
  })

  it('should preserve TLD correctly', () => {
    const result = truncateName('very-long-subdomain-name-here.com')
    expect(result).toMatch(/\.com$/)
    expect(result.length).toBeLessThanOrEqual(24)
  })

  it('should handle names without a TLD', () => {
    const name = 'averylongnamethatexceedsmaxlengthchars'
    const result = truncateName(name)
    expect(result).toMatch(/…/)
    expect(result.length).toBeLessThanOrEqual(24)
  })

  it('should use a custom maxLength', () => {
    const result = truncateName(
      'quasar-mist-silver-locked-resolver-locked.eth',
      16,
    )
    expect(result.length).toBeLessThanOrEqual(16)
    expect(result).toMatch(/\.eth$/)
  })

  it('should not produce output longer than input (slice(-0) edge case)', () => {
    // suffixLen = 0 when available is 1 — slice(-0) would return the full string without the guard
    const name = 'averylongname.e' // TLD is ".e" (2 chars), available = maxLength - 2 - 1
    const result = truncateName(name, 5)
    expect(result.length).toBeLessThanOrEqual(name.length)
  })

  it('should produce output no longer than maxLength', () => {
    const name = 'quasar-mist-silver-locked-resolver-locked.eth'
    const result = truncateName(name, 20)
    expect(result.length).toBeLessThanOrEqual(20)
  })
})
