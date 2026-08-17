import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatNotificationTime, truncateText } from './formatting'

describe('notifications formatting utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('formatNotificationTime', () => {
    it('should return "Just now" for timestamps less than 1 minute ago', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const timestamp = now - 30 * 1000 // 30 seconds ago
      expect(formatNotificationTime(timestamp)).toBe('Just now')
    })

    it('should format minutes ago', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const timestamp = now - 5 * 60 * 1000 // 5 minutes ago
      expect(formatNotificationTime(timestamp)).toBe('5m ago')
    })

    it('should format single minute ago', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const timestamp = now - 1 * 60 * 1000 // 1 minute ago
      expect(formatNotificationTime(timestamp)).toBe('1m ago')
    })

    it('should format hours ago', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const timestamp = now - 3 * 60 * 60 * 1000 // 3 hours ago
      expect(formatNotificationTime(timestamp)).toBe('3h ago')
    })

    it('should format single hour ago', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const timestamp = now - 1 * 60 * 60 * 1000 // 1 hour ago
      expect(formatNotificationTime(timestamp)).toBe('1h ago')
    })

    it('should format days ago', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const timestamp = now - 3 * 24 * 60 * 60 * 1000 // 3 days ago
      expect(formatNotificationTime(timestamp)).toBe('3d ago')
    })

    it('should format single day ago', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const timestamp = now - 1 * 24 * 60 * 60 * 1000 // 1 day ago
      expect(formatNotificationTime(timestamp)).toBe('1d ago')
    })

    it('should return localized date for timestamps older than 7 days', () => {
      const now = new Date('2024-01-15T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const timestamp = new Date('2024-01-01T12:00:00Z').getTime()
      const result = formatNotificationTime(timestamp)
      expect(result).toContain('2024')
      expect(result.length).toBeGreaterThan(4)
    })

    it('should handle edge case at 59 minutes', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const timestamp = now - 59 * 60 * 1000
      expect(formatNotificationTime(timestamp)).toBe('59m ago')
    })

    it('should handle edge case at 23 hours', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const timestamp = now - 23 * 60 * 60 * 1000
      expect(formatNotificationTime(timestamp)).toBe('23h ago')
    })

    it('should handle edge case at 6 days', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)

      const timestamp = now - 6 * 24 * 60 * 60 * 1000
      expect(formatNotificationTime(timestamp)).toBe('6d ago')
    })

    it('should handle current timestamp', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)

      expect(formatNotificationTime(now)).toBe('Just now')
    })
  })

  describe('truncateText', () => {
    it('should not truncate text shorter than max length', () => {
      expect(truncateText('Hello', 10)).toBe('Hello')
    })

    it('should not truncate text equal to max length', () => {
      expect(truncateText('Hello', 5)).toBe('Hello')
    })

    it('should truncate text longer than max length', () => {
      expect(truncateText('Hello World', 5)).toBe('Hello...')
    })

    it('should add ellipsis to truncated text', () => {
      const result = truncateText('This is a long text', 10)
      expect(result).toBe('This is a ...')
      expect(result.length).toBe(13) // 10 + 3 for ellipsis
    })

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('')
    })

    it('should handle single character text', () => {
      expect(truncateText('A', 5)).toBe('A')
      expect(truncateText('A', 0)).toBe('...')
    })

    it('should handle max length of 0', () => {
      expect(truncateText('Hello', 0)).toBe('...')
    })

    it('should handle very long text', () => {
      const longText = 'A'.repeat(1000)
      const result = truncateText(longText, 50)
      expect(result.length).toBe(53)
      expect(result.endsWith('...')).toBe(true)
    })

    it('should preserve exact characters before ellipsis', () => {
      const text = 'Hello World!'
      const result = truncateText(text, 5)
      expect(result).toBe('Hello...')
      expect(result.slice(0, 5)).toBe('Hello')
    })

    it('should handle unicode characters', () => {
      const text = '👋 Hello World 🌍'
      const result = truncateText(text, 10)
      expect(result.length).toBeLessThanOrEqual(13)
      expect(result.endsWith('...')).toBe(true)
    })

    it('should handle special characters', () => {
      const text = 'Hello\nWorld\tTest'
      const result = truncateText(text, 10)
      expect(result).toBe('Hello\nWorl...')
    })
  })
})
