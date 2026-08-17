import type {
  PersonalNotificationPayloads,
  SupportedNotifications,
} from '@ens-apps/shared-schema/notifications'

export type PushNotificationData = {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, string | number | boolean | null>
}

export type PushTemplate<K extends SupportedNotifications<'push'>> = (
  payload: PersonalNotificationPayloads[K],
) => PushNotificationData

export const pushTemplates: {
  [K in SupportedNotifications<'push'>]: PushTemplate<K>
} = {
  'name-expiry': (payload) => {
    const expiryDate = new Date(payload.expiryDate)
    const now = new Date()
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )

    return {
      title: 'ENS Name Expiring Soon',
      body: `${payload.name} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
      tag: `expiry-${payload.name}`,
      data: {
        url: `https://app.ens.domains/${payload.name}`,
        name: payload.name,
        expiryDate: payload.expiryDate,
      },
    }
  },

  'name-transferred': (payload) => ({
    title: 'ENS Name Transferred',
    body: `${payload.name} was transferred to ${payload.to.slice(0, 6)}...${payload.to.slice(-4)}`,
    tag: `transfer-${payload.name}`,
    data: {
      url: `https://app.ens.domains/${payload.name}`,
      name: payload.name,
      txHash: payload.txHash,
    },
  }),
}
