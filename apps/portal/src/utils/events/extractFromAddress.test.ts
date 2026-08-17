import { describe, expect, it } from 'vitest'
import { extractFromAddress } from './extractFromAddress'

describe('extractFromAddress', () => {
  it('should extract owner address', () => {
    const eventDetails = { owner: '0x1234567890123456789012345678901234567890' }
    expect(extractFromAddress(eventDetails)).toBe(
      '0x1234567890123456789012345678901234567890',
    )
  })

  it('should extract registrant address when owner is not present', () => {
    const eventDetails = {
      registrant: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    }
    expect(extractFromAddress(eventDetails)).toBe(
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    )
  })

  it('should extract newOwner address when owner and registrant are not present', () => {
    const eventDetails = {
      newOwner: '0x9999999999999999999999999999999999999999',
    }
    expect(extractFromAddress(eventDetails)).toBe(
      '0x9999999999999999999999999999999999999999',
    )
  })

  it('should prioritize owner over registrant', () => {
    const eventDetails = {
      owner: '0x1111111111111111111111111111111111111111',
      registrant: '0x2222222222222222222222222222222222222222',
    }
    expect(extractFromAddress(eventDetails)).toBe(
      '0x1111111111111111111111111111111111111111',
    )
  })

  it('should prioritize owner over newOwner', () => {
    const eventDetails = {
      owner: '0x1111111111111111111111111111111111111111',
      newOwner: '0x3333333333333333333333333333333333333333',
    }
    expect(extractFromAddress(eventDetails)).toBe(
      '0x1111111111111111111111111111111111111111',
    )
  })

  it('should prioritize registrant over newOwner', () => {
    const eventDetails = {
      registrant: '0x2222222222222222222222222222222222222222',
      newOwner: '0x3333333333333333333333333333333333333333',
    }
    expect(extractFromAddress(eventDetails)).toBe(
      '0x2222222222222222222222222222222222222222',
    )
  })

  it('should return null when no valid address fields are present', () => {
    const eventDetails = { other: 'value', random: 'data' }
    expect(extractFromAddress(eventDetails)).toBeNull()
  })

  it('should return null when address fields are not strings', () => {
    const eventDetails = {
      owner: 123,
      registrant: { address: '0x123' },
      newOwner: null,
    }
    expect(extractFromAddress(eventDetails)).toBeNull()
  })

  it('should handle empty object', () => {
    expect(extractFromAddress({})).toBeNull()
  })
})
