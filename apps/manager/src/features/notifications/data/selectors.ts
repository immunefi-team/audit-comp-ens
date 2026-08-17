import { safeParse } from 'valibot'
import type { BackendNotification } from '@/features/notifications/data/queries/notifications'
import { getNotificationData } from '@/features/notifications/notifications'

const logDroppedNotification = (
  notification: BackendNotification,
  reason: 'invalid' | 'unknown-kind',
) => {
  if (!import.meta.env.DEV) return

  console.debug('[notifications] dropped notification from UI', {
    id: notification.id,
    kind: notification.kind,
    reason,
  })
}

/**
 * Keep only notifications with known kind and valid payload.
 * This runs in TanStack Query select-path (not the render tree).
 */
export const selectValidNotifications = (
  notifications: BackendNotification[],
): BackendNotification[] => {
  const valid: BackendNotification[] = []

  for (const notification of notifications) {
    const { Component, definition } = getNotificationData(notification.kind)

    if (!Component || !definition) {
      logDroppedNotification(notification, 'unknown-kind')
      continue
    }

    if (!safeParse(definition.payloadSchema, notification.payload).success) {
      logDroppedNotification(notification, 'invalid')
      continue
    }

    valid.push(notification)
  }

  return valid
}
