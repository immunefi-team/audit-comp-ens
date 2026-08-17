import type {
  PersonalNotificationPayloads,
  SupportedNotifications,
} from '@ens-apps/shared-schema/notifications'

type TelegramMessage = {
  text: string
  parseMode?: 'Markdown' | 'HTML'
  buttons?: Array<
    Array<{
      text: string
      url?: string
      callbackData?: string
    }>
  >
}

// Template function type
export type TelegramTemplate<K extends SupportedNotifications<'telegram'>> = (
  payload: PersonalNotificationPayloads[K],
) => TelegramMessage

// Define all telegram templates
// TypeScript will error if we miss a notification that telegram supports
export const telegramTemplates: {
  [K in SupportedNotifications<'telegram'>]: TelegramTemplate<K>
} = {
  'name-expiry': (payload) => {
    const daysLeft = Math.ceil(
      (payload.expiryDate - Date.now()) / (1000 * 60 * 60 * 24),
    )

    const ownerText = payload.isOwner
      ? `Your domain \`${payload.name}\` will expire in *${daysLeft} days*.\n\nDon't forget to renew your domain!`
      : `The domain \`${payload.name}\` you're watching will expire in *${daysLeft} days*.`

    return {
      text: `⚠️ *Domain Expiration Alert*\n\n${ownerText}`,
      parseMode: 'Markdown',
      buttons: [
        [
          {
            text: '🔄 Renew Now',
            url: `https://app.ens.domains/${payload.name}`,
          },
        ],
      ],
    }
  },

  'name-transferred': (payload) => {
    return {
      text:
        `🔄 *Domain Transfer*\n\n` +
        `Your domain \`${payload.name}\` has been transferred.\n\n` +
        `To: \`${payload.to}\`\n` +
        `Transaction: \`${payload.txHash}\``,
      parseMode: 'Markdown',
      buttons: [
        [
          {
            text: '🔍 View Transaction',
            url: `https://etherscan.io/tx/${payload.txHash}`,
          },
        ],
      ],
    }
  },
}
