import type { BackendNotification } from '@/features/notifications/data/queries/notifications'
import { getNotificationData } from '@/features/notifications/notifications'
import type { NotificationLayout } from '@/features/notifications/notifications/contracts'

type NotificationItemProps = {
  notification: BackendNotification
  layout?: NotificationLayout
  onAction?: () => void
  onMarkAsRead?: () => void
  onRemove?: () => void
}

export const NotificationItem = ({
  notification,
  layout = 'default',
  onAction,
  onMarkAsRead,
  onRemove,
}: NotificationItemProps) => {
  const { Component, definition } = getNotificationData(notification.kind)

  if (!Component || !definition) {
    return null
  }

  return (
    <Component
      layout={layout}
      onAction={onAction}
      onMarkAsRead={onMarkAsRead}
      onRemove={onRemove}
      // biome-ignore lint/suspicious/noExplicitAny: Generic component union
      payload={notification.payload as any}
      seen={notification.seen}
      timestamp={notification.timestamp}
    />
  )
}
