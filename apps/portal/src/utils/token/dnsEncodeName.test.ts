import { describe, expect, it } from 'vitest'
import { dnsEncodeName } from './dnsEncodeName'

describe('dnsEncodeName', () => {
  it('should encode domain names to hex format', () => {
    const result = dnsEncodeName('vitalik.eth')
    expect(result).toBeTypeOf('string')
    expect(result.startsWith('0x')).toBe(true)
  })

  it('should encode empty string as 0x00', () => {
    expect(dnsEncodeName('')).toBe('0x00')
  })
})
