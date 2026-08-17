import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackendNotification } from '../types'
import { groupNotificationsByTime } from './grouping'

describe('notifications grouping utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createNotification = (
    timestamp: number,
    id = 'test-id',
  ): BackendNotification => ({
    id,
    timestamp,
    seen: false,
    source: 'personal',
    kind: 'name-expiry',
    payload: {
      name: 'test.eth',
      expiryDate: timestamp,
      isOwner: true,
      watchReason: 'owned',
    },
  })

  describe('groupNotificationsByTime', () => {
    it('should return empty groups for empty array', () => {
      const result = groupNotificationsByTime([])
      expect(result.groups).toEqual([])
    })

    it('should group notifications into "Today"', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const notifications = [
        createNotification(now - 1000 * 60 * 30, 'today-1'), // 30 minutes ago
        createNotification(now - 1000 * 60 * 60, 'today-2'), // 1 hour ago
      ]

      const result = groupNotificationsByTime(notifications)

      expect(result.groups).toHaveLength(1)
      expect(result.groups[0]?.title).toBe('Today')
      expect(result.groups[0]?.notifications).toHaveLength(2)
    })

    it('should group notifications into "Yesterday"', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const yesterday = now - 24 * 60 * 60 * 1000

      const notifications = [createNotification(yesterday + 1000 * 60 * 60)]

      const result = groupNotificationsByTime(notifications)

      expect(result.groups).toHaveLength(1)
      expect(result.groups[0]?.title).toBe('Yesterday')
    })

    it('should group notifications into "This week"', () => {
      const now = new Date('2024-01-18T15:00:00Z').getTime() // Thursday
      vi.setSystemTime(now)

      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000 // Monday of this week

      const notifications = [createNotification(threeDaysAgo)]

      const result = groupNotificationsByTime(notifications)

      const thisWeekGroup = result.groups.find((g) => g.title === 'This week')
      expect(thisWeekGroup).toBeDefined()
    })

    it('should group notifications into "Last week"', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const lastWeek = now - 7 * 24 * 60 * 60 * 1000

      const notifications = [createNotification(lastWeek)]

      const result = groupNotificationsByTime(notifications)

      const lastWeekGroup = result.groups.find((g) => g.title === 'Last week')
      expect(lastWeekGroup).toBeDefined()
    })

    it('should group notifications into "This month"', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const thisMonthStart = new Date('2024-01-01T00:00:00Z').getTime()
      const timestamp = thisMonthStart + 1000 * 60 * 60 * 24 // 1 day into month

      const notifications = [createNotification(timestamp)]

      const result = groupNotificationsByTime(notifications)

      const thisMonthGroup = result.groups.find((g) => g.title === 'This month')
      expect(thisMonthGroup).toBeDefined()
    })

    it('should group notifications into "Last month"', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const lastMonth = new Date('2023-12-15T15:00:00Z').getTime()

      const notifications = [createNotification(lastMonth)]

      const result = groupNotificationsByTime(notifications)

      const lastMonthGroup = result.groups.find((g) => g.title === 'Last month')
      expect(lastMonthGroup).toBeDefined()
    })

    it('should group notifications into "Last 3 months"', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const twoMonthsAgo = now - 60 * 24 * 60 * 60 * 1000

      const notifications = [createNotification(twoMonthsAgo)]

      const result = groupNotificationsByTime(notifications)

      const recentGroup = result.groups.find((g) => g.title === 'Last 3 months')
      expect(recentGroup).toBeDefined()
    })

    it('should group notifications into "Last 6 months"', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const fourMonthsAgo = now - 120 * 24 * 60 * 60 * 1000

      const notifications = [createNotification(fourMonthsAgo)]

      const result = groupNotificationsByTime(notifications)

      const olderGroup = result.groups.find((g) => g.title === 'Last 6 months')
      expect(olderGroup).toBeDefined()
    })

    it('should group notifications into "Last year"', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const sevenMonthsAgo = now - 210 * 24 * 60 * 60 * 1000

      const notifications = [createNotification(sevenMonthsAgo)]

      const result = groupNotificationsByTime(notifications)

      const muchOlderGroup = result.groups.find((g) => g.title === 'Last year')
      expect(muchOlderGroup).toBeDefined()
    })

    it('should group notifications into "Older"', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const overOneYearAgo = now - 400 * 24 * 60 * 60 * 1000

      const notifications = [createNotification(overOneYearAgo)]

      const result = groupNotificationsByTime(notifications)

      const ancientGroup = result.groups.find((g) => g.title === 'Older')
      expect(ancientGroup).toBeDefined()
    })

    it('should sort notifications within groups by timestamp (newest first)', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const notifications = [
        createNotification(now - 1000 * 60 * 60, 'older'),
        createNotification(now - 1000 * 60 * 30, 'newer'),
      ]

      const result = groupNotificationsByTime(notifications)

      expect(result.groups[0]?.notifications[0]?.id).toBe('newer')
      expect(result.groups[0]?.notifications[1]?.id).toBe('older')
    })

    it('should handle notifications across multiple groups', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const notifications = [
        createNotification(now - 1000 * 60 * 30, 'today'),
        createNotification(now - 24 * 60 * 60 * 1000 + 1000, 'yesterday'),
        createNotification(now - 400 * 24 * 60 * 60 * 1000, 'ancient'),
      ]

      const result = groupNotificationsByTime(notifications)

      expect(result.groups.length).toBeGreaterThan(1)
      expect(result.groups.some((g) => g.title === 'Today')).toBe(true)
      expect(result.groups.some((g) => g.title === 'Yesterday')).toBe(true)
      expect(result.groups.some((g) => g.title === 'Older')).toBe(true)
    })

    it('should handle notifications with missing timestamp', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const notifications = [
        createNotification(0, 'no-timestamp'),
        createNotification(now - 1000 * 60 * 30, 'with-timestamp'),
      ]

      const result = groupNotificationsByTime(notifications)

      expect(result.groups.length).toBeGreaterThan(0)
    })

    it('should not include empty groups', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const notifications = [createNotification(now - 1000 * 60 * 30, 'today')]

      const result = groupNotificationsByTime(notifications)

      expect(result.groups).toHaveLength(1)
      expect(result.groups[0]?.title).toBe('Today')
    })

    it('should maintain notification order within same group', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const notifications = [
        createNotification(now - 1000 * 60 * 10, 'third'),
        createNotification(now - 1000 * 60 * 5, 'second'),
        createNotification(now - 1000 * 60 * 2, 'first'),
      ]

      const result = groupNotificationsByTime(notifications)

      expect(result.groups[0]?.notifications[0]?.id).toBe('first')
      expect(result.groups[0]?.notifications[1]?.id).toBe('second')
      expect(result.groups[0]?.notifications[2]?.id).toBe('third')
    })

    it('should handle very large number of notifications', () => {
      const now = new Date('2024-01-15T15:00:00Z').getTime()
      vi.setSystemTime(now)

      const notifications = Array.from({ length: 1000 }, (_, i) =>
        createNotification(now - i * 1000 * 60, `notif-${i}`),
      )

      const result = groupNotificationsByTime(notifications)

      const totalNotifications = result.groups.reduce(
        (sum, group) => sum + group.notifications.length,
        0,
      )
      expect(totalNotifications).toBe(1000)
    })
  })
})
