import { describe, expect, it } from 'vitest'
import { isNameOrAddress } from './isNameOrAddress'

const ADDRESS = '0x2245606Dd6B3ae61205fCf8c843E200CC2f1123d'
const ADDRESS_LOWER = '0x2245606dd6b3ae61205fcf8c843e200cc2f1123d'
const ADDRESS_MIXED = '0xAAAAAaaaaaAAAAAaaaaaAAAAAaaaaaAAAAAaaaaa' // wrong checksum
const ADDRESS_39_HEX = '0x2245606Dd6B3ae61205fCf8c843E200CC2f1123' // 1 char short
const ADDRESS_NO_PREFIX = '2245606dd6b3ae61205fcf8c843e200cc2f1123d'
const ADDRESS_NON_HEX = '0xZZZ5606dd6b3ae61205fcf8c843e200cc2f1123d'

describe('isNameOrAddress', () => {
  describe('addresses', () => {
    it('accepts checksummed and all-lowercase hex addresses', () => {
      expect(isNameOrAddress(ADDRESS)).toBe(true)
      expect(isNameOrAddress(ADDRESS_LOWER)).toBe(true)
    })

    it('accepts non-checksummed (mixed-case) addresses — validation is non-strict', () => {
      expect(isNameOrAddress(ADDRESS_MIXED)).toBe(true)
    })

    it('rejects malformed addresses', () => {
      expect(isNameOrAddress('0x1234')).toBe(false) // too short
      expect(isNameOrAddress(ADDRESS_39_HEX)).toBe(false) // 39 hex chars
      expect(isNameOrAddress(ADDRESS_NO_PREFIX)).toBe(false) // missing 0x prefix
      expect(isNameOrAddress(ADDRESS_NON_HEX)).toBe(false) // non-hex characters
    })
  })

  describe('ENS names (must be ≥2 labels and ENSIP-15 normalized)', () => {
    it('accepts normalized multi-label names', () => {
      expect(isNameOrAddress('vitalik.eth')).toBe(true)
      expect(isNameOrAddress('sub.vitalik.eth')).toBe(true)
      expect(isNameOrAddress('deep.sub.vitalik.eth')).toBe(true)
      expect(isNameOrAddress('test-123.eth')).toBe(true)
      expect(isNameOrAddress('foo.box')).toBe(true) // non-.eth TLDs are still valid names
    })

    it('accepts unicode / emoji multi-label names', () => {
      expect(isNameOrAddress('🥹.eth')).toBe(true)
    })

    it('rejects single-label names / bare TLDs (these would otherwise "resolve" via the owner fallback)', () => {
      expect(isNameOrAddress('eth')).toBe(false)
      expect(isNameOrAddress('fox')).toBe(false)
      expect(isNameOrAddress('link')).toBe(false)
    })

    it('rejects non-normalized names', () => {
      expect(isNameOrAddress('Vitalik.eth')).toBe(false) // uppercase
      expect(isNameOrAddress('test!@#.eth')).toBe(false) // invalid characters
      expect(isNameOrAddress('invalid name.eth')).toBe(false) // space
    })

    it('rejects dotted input with empty labels', () => {
      expect(isNameOrAddress('vitalik.eth.')).toBe(false) // trailing dot
      expect(isNameOrAddress('.eth')).toBe(false) // leading dot
      expect(isNameOrAddress('a..b.eth')).toBe(false) // empty middle label
    })
  })

  it('rejects empty and other non-name non-address input', () => {
    expect(isNameOrAddress('')).toBe(false)
    expect(isNameOrAddress('   ')).toBe(false)
    expect(isNameOrAddress('hello world')).toBe(false)
  })
})
