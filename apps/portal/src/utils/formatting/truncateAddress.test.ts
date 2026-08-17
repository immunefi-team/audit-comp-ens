import { describe, expect, it } from 'vitest'
import { truncateAddress } from './truncateAddress'

const TEST_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'

describe('truncateAddress', () => {
  it('should truncate a standard Ethereum address with defaults', () => {
    const result = truncateAddress(TEST_ADDRESS)

    expect(result).toBe('0x1234…5678')
  })

  it('should truncate a transaction hash with defaults', () => {
    const txHash =
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

    const result = truncateAddress(txHash)

    expect(result).toBe('0xabcd…7890')
  })

  it('should use custom start and end character counts', () => {
    const result = truncateAddress(TEST_ADDRESS, 10, 6)

    expect(result).toBe('0x12345678…345678')
  })

  it('should use custom separator', () => {
    const result = truncateAddress(TEST_ADDRESS, 6, 4, '...')

    expect(result).toBe('0x1234...5678')
  })

  it('should not truncate if value is shorter than or equal to startChars + endChars', () => {
    const shortValue = '0x123456'

    const result = truncateAddress(shortValue, 6, 4)

    expect(result).toBe('0x123456')
  })

  it('should handle exactly startChars + endChars length', () => {
    const exactValue = '0x12345678' // 6 + 4 = 10 chars (including 0x)

    const result = truncateAddress(exactValue, 6, 4)

    expect(result).toBe('0x12345678')
  })

  it('should work with values not starting with 0x', () => {
    const value = 'abcdef1234567890abcdef1234567890abcdef12'

    const result = truncateAddress(value)

    expect(result).toBe('abcdef…ef12')
  })
})
