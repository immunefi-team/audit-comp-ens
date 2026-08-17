import type {
  NotificationPayloads,
  NotificationKind as SharedNotificationKind,
} from '@ens-apps/shared-schema/notifications'
import type { FC } from 'react'
import type { BackendNotification } from '@/features/notifications/data/queries/notifications'

export type NotificationKind = SharedNotificationKind

export type NotificationForKind<K extends NotificationKind> = Extract<
  BackendNotification,
  { kind: K }
>

export type NotificationPayloadForKind<K extends NotificationKind> =
  NotificationForKind<K>['payload']

export type NotificationLayout = 'default' | 'compact'

export type KindComponentProps<K extends NotificationKind> = {
  payload: NotificationPayloads[K]
  seen: boolean
  timestamp: number
  layout?: NotificationLayout
  onAction?: () => void
  onMarkAsRead?: () => void
  onRemove?: () => void
}

/**
 * Manager-owned kind contract.
 *
 * Each kind module owns payload validation and the final React component.
 * Invalid payloads are filtered out before rendering.
 */
export type KindComponent<K extends NotificationKind> = FC<
  KindComponentProps<K>
>
