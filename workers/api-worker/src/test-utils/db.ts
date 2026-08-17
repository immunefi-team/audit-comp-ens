import { vi } from 'vitest'

export function makeMockDb(overrides?: {
  users?: Array<{ id: string; address: string }>
  favorites?: Array<{ user_id: string; name: string }>
  insertedNotifications?: Array<{
    id: string
    user_id: string
    kind: 'name-expiry'
    payload: unknown
  }>
  userChannels?: Array<{
    user_id: string
    channel: string
    target: string | null
    status?: string
  }>
  userSettings?: Array<{
    user_id: string
    owned_name_expiry: boolean
    favourited_name_expiry: boolean
  }>
}) {
  const state = {
    users: overrides?.users ?? [],
    favorites: overrides?.favorites ?? [],
    insertedNotifications: overrides?.insertedNotifications ?? [],
    userChannels: overrides?.userChannels ?? [],
    userSettings: overrides?.userSettings ?? [],
  }

  const notificationsInsertValues: unknown[] = []
  const deliveriesInsertValues: unknown[] = []

  const notificationsInsertChain = {
    values: vi.fn((values: unknown[]) => {
      notificationsInsertValues.push(...values)
      return notificationsInsertChain
    }),
    onConflictDoNothing: vi.fn(() => notificationsInsertChain),
    returning: vi.fn(async () => state.insertedNotifications),
  }

  const deliveriesInsertChain = {
    values: vi.fn(async (values: unknown[]) => {
      deliveriesInsertValues.push(...values)
      return []
    }),
  }

  const db = {
    query: {
      users: {
        findMany: vi.fn(async () => state.users),
      },
      favorites: {
        findMany: vi.fn(async () => state.favorites),
      },
      userChannels: {
        findMany: vi.fn(async () => state.userChannels),
      },
      userNotificationSettings: {
        findMany: vi.fn(async () => state.userSettings),
      },
    },
    insert: vi.fn((table: unknown) => {
      const tableString = String(table)
      if (tableString.includes('notifications')) {
        return notificationsInsertChain
      }

      if (tableString.includes('notification_deliveries')) {
        return deliveriesInsertChain
      }

      // Fallback: treat the first insert as notifications and second as deliveries.
      if (notificationsInsertChain.values.mock.calls.length === 0) {
        return notificationsInsertChain
      }

      return deliveriesInsertChain
    }),
  }

  return {
    db,
    notificationsInsertValues,
    deliveriesInsertValues,
    notificationsInsertChain,
    deliveriesInsertChain,
  }
}
