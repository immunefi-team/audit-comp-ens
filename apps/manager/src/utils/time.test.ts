import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatExpiryTime, formatRelativeTime, TIME_UNITS } from './time'

describe('time utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('TIME_UNITS', () => {
    it('should have correct minute value', () => {
      expect(TIME_UNITS.MINUTE).toBe(60 * 1000)
    })

    it('should have correct hour value', () => {
      expect(TIME_UNITS.HOUR).toBe(60 * 60 * 1000)
    })

    it('should have correct day value', () => {
      expect(TIME_UNITS.DAY).toBe(24 * 60 * 60 * 1000)
    })

    it('should have correct week value', () => {
      expect(TIME_UNITS.WEEK).toBe(7 * 24 * 60 * 60 * 1000)
    })

    it('should have correct month value', () => {
      expect(TIME_UNITS.MONTH).toBe(30 * 24 * 60 * 60 * 1000)
    })

    it('should have correct year value', () => {
      expect(TIME_UNITS.YEAR).toBe(365 * 24 * 60 * 60 * 1000)
    })
  })

  describe('formatRelativeTime', () => {
    it('should return "Just now" for recent timestamps', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - 30000)).toBe('Just now')
    })

    it('should format minutes ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.MINUTE * 5)).toBe('5 min ago')
    })

    it('should format 1 minute ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.MINUTE)).toBe('1 min ago')
    })

    it('should format hours ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.HOUR * 3)).toBe('3h ago')
    })

    it('should format 1 hour ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.HOUR)).toBe('1h ago')
    })

    it('should format single day ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.DAY)).toBe('1 day ago')
    })

    it('should format multiple days ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.DAY * 3)).toBe('3 days ago')
    })

    it('should format single week ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.WEEK)).toBe('1 week ago')
    })

    it('should format multiple weeks ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.WEEK * 2)).toBe('2 weeks ago')
    })

    it('should format single month ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.MONTH)).toBe('1 month ago')
    })

    it('should format multiple months ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.MONTH * 6)).toBe(
        '6 months ago',
      )
    })

    it('should format single year ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.YEAR)).toBe('1 year ago')
    })

    it('should format multiple years ago', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      expect(formatRelativeTime(now - TIME_UNITS.YEAR * 3)).toBe('3 years ago')
    })

    it('should handle edge cases at boundaries', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      expect(formatRelativeTime(now - (TIME_UNITS.MINUTE - 1000))).toBe(
        'Just now',
      )
      expect(formatRelativeTime(now - (TIME_UNITS.HOUR - 1000))).toBe(
        '59 min ago',
      )
    })

    it('should floor partial units', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      expect(formatRelativeTime(now - TIME_UNITS.MINUTE * 1.9)).toBe(
        '1 min ago',
      )
      expect(formatRelativeTime(now - TIME_UNITS.HOUR * 2.9)).toBe('2h ago')
    })
  })

  describe('formatExpiryTime', () => {
    it('should return Expired for past dates', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const result = formatExpiryTime(now - 1000)
      expect(result.text).toBe('Expired')
      expect(result.isExpired).toBe(true)
    })

    it('should return Expired when expiry is exactly now', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const result = formatExpiryTime(now)
      expect(result.text).toBe('Expired')
      expect(result.isExpired).toBe(true)
    })

    it('should format minutes until expiry', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const result = formatExpiryTime(now + TIME_UNITS.MINUTE * 30)
      expect(result.text).toBe('Expires in 30 min')
      expect(result.isExpired).toBe(false)
    })

    it('should format 1 minute until expiry', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const result = formatExpiryTime(now + TIME_UNITS.MINUTE)
      expect(result.text).toBe('Expires in 1 min')
      expect(result.isExpired).toBe(false)
    })

    it('should format hours until expiry', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const result = formatExpiryTime(now + TIME_UNITS.HOUR * 5)
      expect(result.text).toBe('Expires in 5h')
      expect(result.isExpired).toBe(false)
    })

    it('should format 1 hour until expiry', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const result = formatExpiryTime(now + TIME_UNITS.HOUR)
      expect(result.text).toBe('Expires in 1h')
      expect(result.isExpired).toBe(false)
    })

    it('should format single day until expiry', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const result = formatExpiryTime(now + TIME_UNITS.DAY)
      expect(result.text).toBe('Expires in 1 day')
      expect(result.isExpired).toBe(false)
    })

    it('should format multiple days until expiry', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const result = formatExpiryTime(now + TIME_UNITS.DAY * 7)
      expect(result.text).toBe('Expires in 7 days')
      expect(result.isExpired).toBe(false)
    })

    it('should handle edge cases at boundaries', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const result1 = formatExpiryTime(now + TIME_UNITS.MINUTE - 1000)
      expect(result1.text).toBe('Expires in 0 min')
      expect(result1.isExpired).toBe(false)

      const result2 = formatExpiryTime(now + TIME_UNITS.HOUR - 1000)
      expect(result2.text).toBe('Expires in 59 min')
      expect(result2.isExpired).toBe(false)
    })

    it('should floor partial units', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const result1 = formatExpiryTime(now + TIME_UNITS.MINUTE * 1.9)
      expect(result1.text).toBe('Expires in 1 min')

      const result2 = formatExpiryTime(now + TIME_UNITS.DAY * 2.9)
      expect(result2.text).toBe('Expires in 2 days')
    })

    it('should handle very large future dates', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const result = formatExpiryTime(now + TIME_UNITS.DAY * 365)
      expect(result.text).toBe('Expires in 365 days')
      expect(result.isExpired).toBe(false)
    })

    it('should handle 1 millisecond before expiry', () => {
      const now = Date.now()
      vi.setSystemTime(now)
      const result = formatExpiryTime(now + 1)
      expect(result.text).toBe('Expires in 0 min')
      expect(result.isExpired).toBe(false)
    })
  })
})
