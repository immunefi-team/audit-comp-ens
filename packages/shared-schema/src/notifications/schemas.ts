import * as v from 'valibot'
import type {
  BroadcastNotificationKind,
  BroadcastNotificationPayloads,
  NotificationKind,
  NotificationPayloads,
  PersonalNotificationKind,
  PersonalNotificationPayloads,
} from './catalog'
import type { channelDefinitions } from './channels'

export type AnyNotificationPayload = NotificationPayloads[NotificationKind]
export type AnyPersonalNotificationPayload =
  PersonalNotificationPayloads[PersonalNotificationKind]
export type AnyBroadcastNotificationPayload =
  BroadcastNotificationPayloads[BroadcastNotificationKind]

export type BroadcastNotification = {
  [K in BroadcastNotificationKind]: {
    kind: K
  } & BroadcastNotificationPayloads[K]
}[BroadcastNotificationKind]

export type ChannelData = {
  [K in keyof typeof channelDefinitions]: v.InferOutput<
    (typeof channelDefinitions)[K]['dataSchema']
  >
}

export type AnyChannelData = ChannelData[keyof ChannelData]

export const UserNotificationSettingsSchema = v.object({
  ownedNameExpiry: v.boolean(),
  favouritedNameExpiry: v.boolean(),
  ensLabsUpdates: v.boolean(),
})

export type UserNotificationSettings = v.InferOutput<
  typeof UserNotificationSettingsSchema
>
