import type { ChannelType } from '@ens-apps/shared-schema/notifications'

/**
 * Maps channel types to their corresponding Cloudflare queue bindings.
 *
 * To add a new channel:
 * 1. Add the channel type to ChannelType in config/notifications.ts
 * 2. Add the queue binding to wrangler.jsonc and update CloudflareBindings type
 * 3. Add an entry here mapping channel -> queue binding name
 * 4. Add the queue handler in queues/index.ts
 */
export const CHANNEL_TO_QUEUE = {
  telegram: 'TELEGRAM_QUEUE',
  email: 'EMAIL_QUEUE',
  push: 'PUSH_QUEUE',
} as const satisfies Partial<Record<ChannelType, keyof CloudflareBindings>>

export function getQueueForChannel(
  channel: ChannelType,
): keyof CloudflareBindings | undefined {
  return CHANNEL_TO_QUEUE[channel as keyof typeof CHANNEL_TO_QUEUE]
}
