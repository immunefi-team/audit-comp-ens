import { TIME_UNITS } from '@/utils/time'
import type { BackendNotification, GroupedNotifications } from '../types'

export const groupNotificationsByTime = (
  notifications: BackendNotification[],
): GroupedNotifications => {
  if (notifications.length === 0) {
    return { groups: [] }
  }

  const now = Date.now()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todayStart = today.getTime()

  const yesterday = new Date(todayStart - TIME_UNITS.DAY)
  const yesterdayStart = yesterday.getTime()

  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(today.getDate() - today.getDay()) // Start of current week (Sunday)
  const thisWeekStartTime = thisWeekStart.getTime()

  const lastWeekStart = thisWeekStartTime - 7 * TIME_UNITS.DAY

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const thisMonthStartTime = thisMonthStart.getTime()

  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonthStartTime = lastMonthStart.getTime()

  const threeMonthsAgo = now - 90 * TIME_UNITS.DAY
  const sixMonthsAgo = now - 180 * TIME_UNITS.DAY
  const oneYearAgo = now - 365 * TIME_UNITS.DAY

  // Sort notifications by timestamp (newest first)
  const sortedNotifications = [...notifications].sort((a, b) => {
    const aTime = a.timestamp || 0
    const bTime = b.timestamp || 0
    return bTime - aTime
  })

  const groups: { title: string; notifications: BackendNotification[] }[] = []

  const addGroup = (title: string, notifications: BackendNotification[]) => {
    if (notifications.length > 0) {
      groups.push({ title, notifications })
    }
  }

  // Group notifications
  const today_notifications = sortedNotifications.filter((n) => {
    const time = n.timestamp || 0
    return time >= todayStart
  })
  const yesterday_notifications = sortedNotifications.filter((n) => {
    const time = n.timestamp || 0
    return time >= yesterdayStart && time < todayStart
  })
  const thisWeek_notifications = sortedNotifications.filter((n) => {
    const time = n.timestamp || 0
    return time >= thisWeekStartTime && time < yesterdayStart
  })
  const lastWeek_notifications = sortedNotifications.filter((n) => {
    const time = n.timestamp || 0
    return time >= lastWeekStart && time < thisWeekStartTime
  })
  const thisMonth_notifications = sortedNotifications.filter((n) => {
    const time = n.timestamp || 0
    return time >= thisMonthStartTime && time < lastWeekStart
  })
  const lastMonth_notifications = sortedNotifications.filter((n) => {
    const time = n.timestamp || 0
    return time >= lastMonthStartTime && time < thisMonthStartTime
  })
  const recent_notifications = sortedNotifications.filter((n) => {
    const time = n.timestamp || 0
    return time >= threeMonthsAgo && time < lastMonthStartTime
  })
  const older_notifications = sortedNotifications.filter((n) => {
    const time = n.timestamp || 0
    return time >= sixMonthsAgo && time < threeMonthsAgo
  })
  const muchOlder_notifications = sortedNotifications.filter((n) => {
    const time = n.timestamp || 0
    return time >= oneYearAgo && time < sixMonthsAgo
  })
  const ancient_notifications = sortedNotifications.filter((n) => {
    const time = n.timestamp || 0
    return time < oneYearAgo
  })

  // Add groups in chronological order
  addGroup('Today', today_notifications)
  addGroup('Yesterday', yesterday_notifications)
  addGroup('This week', thisWeek_notifications)
  addGroup('Last week', lastWeek_notifications)
  addGroup('This month', thisMonth_notifications)
  addGroup('Last month', lastMonth_notifications)
  addGroup('Last 3 months', recent_notifications)
  addGroup('Last 6 months', older_notifications)
  addGroup('Last year', muchOlder_notifications)
  addGroup('Older', ancient_notifications)

  return { groups }
}
