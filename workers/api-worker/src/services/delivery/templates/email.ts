import { env } from 'cloudflare:workers'
import type {
  PersonalNotificationPayloads,
  SupportedNotifications,
} from '@ens-apps/shared-schema/notifications'

export type EmailTemplate<K extends SupportedNotifications<'email'>> = (
  payload: PersonalNotificationPayloads[K],
) => {
  templateId: string
  dynamicData: Record<string, unknown>
  subject: string
}

export const emailTemplates: {
  [K in SupportedNotifications<'email'>]: EmailTemplate<K>
} = {
  'name-expiry': (payload) => ({
    templateId: env.SENDGRID_TEMPLATE_IDS['name-expiry'],
    dynamicData: {
      name: payload.name,
      expiryDate: new Date(payload.expiryDate).toLocaleDateString(),
      expiryDays: Math.ceil(
        (payload.expiryDate - Date.now()) / (1000 * 60 * 60 * 24),
      ),
      isOwner: payload.isOwner,
    },
    subject: 'Domain Expiration Alert',
  }),

  'name-transferred': (payload) => ({
    templateId: env.SENDGRID_TEMPLATE_IDS['name-transferred'],
    dynamicData: {
      name: payload.name,
      to: payload.to,
      txHash: payload.txHash,
    },
    subject: 'Domain Transferred',
  }),
}
