import type { InferResponseType } from 'hono'
import type { backendClient } from '@/utils/backend-client'

// Backend notification types
export type BackendNotification = InferResponseType<
  typeof backendClient.notifications.$get
>['notifications'][number]

// Notification grouping types
export interface NotificationGroup {
  title: string
  notifications: BackendNotification[]
}

export interface GroupedNotifications {
  groups: NotificationGroup[]
}

// Notification item types
export interface NotificationItemProps {
  notification: BackendNotification
}

// Notification list types
export interface NotificationListProps {
  notifications: BackendNotification[]
}
