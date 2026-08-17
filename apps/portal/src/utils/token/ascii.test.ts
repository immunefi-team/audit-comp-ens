import { describe, expect, it } from 'vitest'
import { asciiEncode } from './ascii'

describe('asciiEncode', () => {
  it('should return ASCII names unchanged', () => {
    expect(asciiEncode('example.com')).toBe('example.com')
    expect(asciiEncode('sub.example.com')).toBe('sub.example.com')
  })

  it('should punycode encode internationalized domain names', () => {
    expect(asciiEncode('münchen.de')).toBe('xn--mnchen-3ya.de')
    expect(asciiEncode('💩.eth')).toContain('xn--')
  })

  it('should return invalid inputs unchanged', () => {
    expect(asciiEncode('not a valid domain')).toBe('not a valid domain')
    expect(asciiEncode('')).toBe('')
  })
})
