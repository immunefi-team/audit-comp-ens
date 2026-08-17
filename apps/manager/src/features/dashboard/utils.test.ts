import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatDashboardDate,
  getDaysUntil,
  isExpiringSoon,
  resolveDomainLabel,
  toDateFromSeconds,
} from './utils'

describe('dashboard utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('formatDashboardDate', () => {
    it('should format a valid date', () => {
      const date = new Date('2024-03-15T12:00:00Z')
      expect(formatDashboardDate(date)).toBe('March 15, 2024')
    })

    it('should return dash for null', () => {
      expect(formatDashboardDate(null)).toBe('—')
    })

    it('should return dash for undefined', () => {
      expect(formatDashboardDate(undefined)).toBe('—')
    })

    it('should return dash for invalid date', () => {
      expect(formatDashboardDate(new Date('invalid'))).toBe('—')
    })

    it('should format dates with different months correctly', () => {
      expect(formatDashboardDate(new Date('2024-01-01T12:00:00Z'))).toBe(
        'January 1, 2024',
      )
      expect(formatDashboardDate(new Date('2024-06-15T12:00:00Z'))).toBe(
        'June 15, 2024',
      )
      expect(formatDashboardDate(new Date('2024-12-31T12:00:00Z'))).toBe(
        'December 31, 2024',
      )
    })
  })

  describe('getDaysUntil', () => {
    it('should return correct days until future date', () => {
      const now = new Date('2024-03-15T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const futureDate = new Date('2024-03-20T12:00:00Z')
      expect(getDaysUntil(futureDate)).toBe(5)
    })

    it('should return negative days for past dates', () => {
      const now = new Date('2024-03-15T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const pastDate = new Date('2024-03-10T12:00:00Z')
      expect(getDaysUntil(pastDate)).toBe(-5)
    })

    it('should return 0 for same day', () => {
      const now = new Date('2024-03-15T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const sameDay = new Date('2024-03-15T18:00:00Z')
      expect(getDaysUntil(sameDay)).toBe(1)
    })

    it('should return null for null input', () => {
      expect(getDaysUntil(null)).toBeNull()
    })

    it('should return null for undefined input', () => {
      expect(getDaysUntil(undefined)).toBeNull()
    })

    it('should return null for invalid date', () => {
      expect(getDaysUntil(new Date('invalid'))).toBeNull()
    })

    it('should ceil partial days', () => {
      const now = new Date('2024-03-15T00:00:00Z').getTime()
      vi.setSystemTime(now)

      const futureDate = new Date('2024-03-16T01:00:00Z')
      expect(getDaysUntil(futureDate)).toBe(2)
    })
  })

  describe('isExpiringSoon', () => {
    it('should return true for dates within default threshold (30 days)', () => {
      const now = new Date('2024-03-15T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const expiringDate = new Date('2024-04-01T12:00:00Z')
      expect(isExpiringSoon(expiringDate)).toBe(true)
    })

    it('should return false for dates beyond threshold', () => {
      const now = new Date('2024-03-15T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const distantDate = new Date('2024-05-15T12:00:00Z')
      expect(isExpiringSoon(distantDate)).toBe(false)
    })

    it('should return false for past dates (already expired)', () => {
      const now = new Date('2024-03-15T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const pastDate = new Date('2024-03-10T12:00:00Z')
      expect(isExpiringSoon(pastDate)).toBe(false)
    })

    it('should use custom threshold when provided', () => {
      const now = new Date('2024-03-15T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const date = new Date('2024-03-22T12:00:00Z')
      expect(isExpiringSoon(date, 10)).toBe(true)
      expect(isExpiringSoon(date, 5)).toBe(false)
    })

    it('should use daysUntilOverride when provided', () => {
      const now = new Date('2024-03-15T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const date = new Date('2024-05-15T12:00:00Z')
      expect(isExpiringSoon(date, 30, 15)).toBe(true)
      expect(isExpiringSoon(date, 30, 45)).toBe(false)
    })

    it('should return false for null input', () => {
      expect(isExpiringSoon(null)).toBe(false)
    })

    it('should return false for undefined input', () => {
      expect(isExpiringSoon(undefined)).toBe(false)
    })

    it('should return true for exactly threshold days', () => {
      const now = new Date('2024-03-15T00:00:00Z').getTime()
      vi.setSystemTime(now)

      const date = new Date('2024-04-14T00:00:00Z')
      expect(isExpiringSoon(date, 30)).toBe(true)
    })

    it('should return false when daysUntilOverride is null', () => {
      expect(isExpiringSoon(null, 30, null)).toBe(false)
    })
  })

  describe('resolveDomainLabel', () => {
    it('should return name when available', () => {
      const domain = {
        id: '123',
        name: 'example.eth',
        normalizedName: 'example.eth',
      }
      expect(resolveDomainLabel(domain)).toBe('example.eth')
    })

    it('should return normalizedName when name is null', () => {
      const domain = { id: '123', name: null, normalizedName: 'example.eth' }
      expect(resolveDomainLabel(domain)).toBe('example.eth')
    })

    it('should return normalizedName when name is undefined', () => {
      const domain = { id: '123', normalizedName: 'example.eth' }
      expect(resolveDomainLabel(domain)).toBe('example.eth')
    })

    it('should return id when both name and normalizedName are null', () => {
      const domain = { id: '123', name: null, normalizedName: null }
      expect(resolveDomainLabel(domain)).toBe('123')
    })

    it('should return id when only id is provided', () => {
      const domain = { id: '123' }
      expect(resolveDomainLabel(domain)).toBe('123')
    })

    it('should prefer name over normalizedName', () => {
      const domain = {
        id: '123',
        name: 'Display Name',
        normalizedName: 'normalized',
      }
      expect(resolveDomainLabel(domain)).toBe('Display Name')
    })

    it('should handle empty string name', () => {
      const domain = { id: '123', name: '', normalizedName: 'example.eth' }
      expect(resolveDomainLabel(domain)).toBe('')
    })
  })

  describe('toDateFromSeconds', () => {
    it('should convert unix timestamp to date', () => {
      const timestamp = 1710505200
      const result = toDateFromSeconds(timestamp)
      expect(result).toBeInstanceOf(Date)
      expect(result?.getTime()).toBe(timestamp * 1000)
    })

    it('should return null for null input', () => {
      expect(toDateFromSeconds(null)).toBeNull()
    })

    it('should return null for undefined input', () => {
      expect(toDateFromSeconds(undefined)).toBeNull()
    })

    it('should handle zero timestamp', () => {
      const result = toDateFromSeconds(0)
      expect(result).toBeInstanceOf(Date)
      expect(result?.getTime()).toBe(0)
    })

    it('should handle large timestamps', () => {
      const timestamp = 2147483647
      const result = toDateFromSeconds(timestamp)
      expect(result).toBeInstanceOf(Date)
      expect(result?.getTime()).toBe(timestamp * 1000)
    })

    it('should handle negative timestamps', () => {
      const timestamp = -1000
      const result = toDateFromSeconds(timestamp)
      expect(result).toBeInstanceOf(Date)
      expect(result?.getTime()).toBe(timestamp * 1000)
    })
  })
})
