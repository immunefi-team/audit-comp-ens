import { describe, expect, it } from 'vitest'
import { formatEventValue } from './formatEventValue'

describe('formatEventValue', () => {
  describe('null and undefined handling', () => {
    it('should return "-" for null', () => {
      expect(formatEventValue('any', null)).toBe('-')
    })

    it('should return "-" for undefined', () => {
      expect(formatEventValue('any', undefined)).toBe('-')
    })
  })

  describe('date/timestamp formatting', () => {
    it('should format Unix timestamps for date-related fields (case-insensitive)', () => {
      const timestamp = 1704067200 // 2024-01-01 00:00:00 UTC

      expect(formatEventValue('expiryDate', timestamp)).toMatch(
        /\d{2}\/\d{2}\/\d{4}/,
      )
      expect(formatEventValue('expiry', timestamp)).toMatch(
        /\d{2}\/\d{2}\/\d{4}/,
      )
      expect(formatEventValue('ExpiryDate', timestamp)).toMatch(
        /\d{2}\/\d{2}\/\d{4}/,
      )
      expect(formatEventValue('creation_date', timestamp)).toMatch(
        /\d{2}\/\d{2}\/\d{4}/,
      )
    })

    it('should handle different timestamp input types', () => {
      const unixTimestamp = 1704067200

      expect(formatEventValue('date', unixTimestamp)).toMatch(
        /\d{2}\/\d{2}\/\d{4}/,
      )
      expect(formatEventValue('date', BigInt(unixTimestamp))).toMatch(
        /\d{2}\/\d{2}\/\d{4}/,
      )
      expect(formatEventValue('date', String(unixTimestamp))).toMatch(
        /\d{2}\/\d{2}\/\d{4}/,
      )
    })

    it('should only format numbers > 1_000_000_000 as timestamps', () => {
      expect(formatEventValue('date', 1000000000)).toBe('1000000000')
      expect(formatEventValue('date', 1000000001)).toMatch(
        /\d{2}\/\d{2}\/\d{4}/,
      )
    })
  })

  describe('non-date field handling', () => {
    it('should convert values to strings for regular fields', () => {
      expect(formatEventValue('owner', '0x1234')).toBe('0x1234')
      expect(formatEventValue('count', 42)).toBe('42')
      expect(formatEventValue('balance', 123456789n)).toBe('123456789')
    })
  })
})
