import { describe, expect, it } from 'vitest'
import { dnsEncodeName } from './dnsEncodeName'

describe('dnsEncodeName', () => {
  it('encodes a 2LD (vitalik.eth) to the correct hex', () => {
    expect(dnsEncodeName('vitalik.eth')).toBe('0x07766974616c696b0365746800')
  })

  it('encodes an empty string to 0x00', () => {
    expect(dnsEncodeName('')).toBe('0x00')
  })

  it('encodes a 3LD starting with the correct label prefix and ending with 00', () => {
    const result = dnsEncodeName('sub.vault.eth')
    // length-prefixed "sub" = 0x03 + "sub" (73 75 62)
    expect(result.startsWith('0x03737562')).toBe(true)
    expect(result.endsWith('00')).toBe(true)
  })

  it('always returns a 0x-prefixed string with even hex length', () => {
    const result = dnsEncodeName('vitalik.eth')
    expect(result.startsWith('0x')).toBe(true)
    // hex portion (after 0x) must be even-length
    expect((result.length - 2) % 2).toBe(0)
  })
})
