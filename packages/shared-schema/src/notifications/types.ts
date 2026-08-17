import type * as v from 'valibot'
import type { ChannelType } from './channels'

export type NotificationSource = 'personal' | 'broadcast'
export type NotificationPriority = 'low' | 'medium' | 'high'

export type DeliveryPreferenceKey =
  | 'ownedNameExpiry'
  | 'favouritedNameExpiry'
  | 'ensLabsUpdates'
  | 'watchBasedNameExpiry'

export type PayloadSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>

export type NotificationMetadata = {
  category: string
  label: string
  description: string
  priority: NotificationPriority
  recommended: boolean
  tags?: readonly string[]
  thresholds?: readonly number[]
}

export type NotificationDelivery =
  | {
      mode: 'opt-in'
      channels: readonly ChannelType[]
      preferenceKey?: DeliveryPreferenceKey
    }
  | {
      mode: 'none'
    }

export type NotificationDefinition = {
  kind: string
  source: NotificationSource
  payloadSchema: PayloadSchema
  metadata: NotificationMetadata
  delivery: NotificationDelivery
}
