import type * as v from 'valibot'
import type { ChannelType } from './channels'
import { type NotificationDefinitions, notificationDefinitions } from './kinds'

export { type NotificationDefinitions, notificationDefinitions }

export type NotificationKind = keyof NotificationDefinitions

export type PersonalNotificationKind = {
  [K in keyof NotificationDefinitions]: NotificationDefinitions[K]['source'] extends 'personal'
    ? K
    : never
}[keyof NotificationDefinitions]

export type BroadcastNotificationKind = {
  [K in keyof NotificationDefinitions]: NotificationDefinitions[K]['source'] extends 'broadcast'
    ? K
    : never
}[keyof NotificationDefinitions]

export type NotificationPayloads = {
  [K in NotificationKind]: v.InferOutput<
    NotificationDefinitions[K]['payloadSchema']
  >
}

export type PersonalNotificationPayloads = {
  [K in PersonalNotificationKind]: NotificationPayloads[K]
}

export type BroadcastNotificationPayloads = {
  [K in BroadcastNotificationKind]: NotificationPayloads[K]
}

export type SupportedNotifications<C extends ChannelType> = {
  [K in PersonalNotificationKind]: C extends Extract<
    NotificationDefinitions[K]['delivery'],
    { mode: 'opt-in' }
  >['channels'][number]
    ? K
    : never
}[PersonalNotificationKind]

export const channelSupportsNotification = (
  channel: ChannelType,
  kind: PersonalNotificationKind,
): boolean =>
  'channels' in notificationDefinitions[kind].delivery &&
  notificationDefinitions[kind].delivery.channels.includes(channel)
