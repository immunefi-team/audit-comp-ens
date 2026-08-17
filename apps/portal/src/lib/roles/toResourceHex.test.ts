import { describe, expect, it } from 'vitest'
import { toResourceHex } from './toResourceHex'

describe('toResourceHex', () => {
  it('should pad to 64 hex characters with 0x prefix', () => {
    const result = toResourceHex(0xaan)
    expect(result).toBe(
      '0x00000000000000000000000000000000000000000000000000000000000000aa',
    )
  })

  it('should handle zero', () => {
    const result = toResourceHex(0n)
    expect(result).toBe(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    )
  })

  it('should handle large values without extra padding', () => {
    const result =
      toResourceHex(
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
      )
    expect(result).toBe(
      '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    )
  })
})
