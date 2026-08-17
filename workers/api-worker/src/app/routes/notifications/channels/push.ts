import type { ChannelData } from '@ens-apps/shared-schema/notifications'
import { vValidator } from '@hono/valibot-validator'
import { and, eq } from 'drizzle-orm'
import * as v from 'valibot'
import { requireAuth } from '#app/middleware/auth.js'
import { injectDb } from '#app/middleware/database.js'
import { createApp } from '#app/middleware/hono.js'
import { TABLE } from '#core/database/index.js'
import { logger } from '#utils/logger.js'

// allowed push service endpoint prefixes (for SSRF protection)
const ALLOWED_PUSH_ENDPOINTS = [
  'https://fcm.googleapis.com/', // chrome, edge, android
  'https://updates.push.services.mozilla.com/', // firefox
  'https://push.services.mozilla.com/', // firefox (older)
  'https://web.push.apple.com/', // safari
] as const

const isAllowedPushEndpoint = (url: string): boolean => {
  // check common prefixes first
  if (ALLOWED_PUSH_ENDPOINTS.some((prefix) => url.startsWith(prefix))) {
    return true
  }

  // windows uses subdomains like wns2-par02p.notify.windows.com
  try {
    const parsed = new URL(url)
    if (
      parsed.protocol === 'https:' &&
      parsed.hostname.endsWith('.notify.windows.com')
    ) {
      return true
    }
  } catch {
    return false
  }

  return false
}

export default createApp()
  .basePath('/push')
  // Push notification routes
  .get('/vapid-public-key', async (c) => {
    return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY })
  })
  .post(
    '/',
    ...requireAuth,
    injectDb,
    vValidator(
      'json',
      v.object({
        endpoint: v.pipe(
          v.string(),
          v.url(),
          v.check(isAllowedPushEndpoint, 'Invalid push service endpoint'),
        ),
        expirationTime: v.optional(v.nullable(v.number())),
        keys: v.object({
          auth: v.string(),
          p256dh: v.string(),
        }),
      }),
    ),
    async (c) => {
      const userId = c.var.user_id
      const subscription = c.req.valid('json')

      // Check if already subscribed with this endpoint
      const existingChannel = await c.var.db.query.userChannels.findFirst({
        where: and(
          eq(TABLE.userChannels.user_id, userId),
          eq(TABLE.userChannels.channel, 'push'),
          eq(TABLE.userChannels.target, subscription.endpoint),
        ),
      })

      if (existingChannel) {
        // Update keys if subscription exists (keys may have rotated)
        await c.var.db
          .update(TABLE.userChannels)
          .set({
            data: {
              auth: subscription.keys.auth,
              p256dh: subscription.keys.p256dh,
              expirationTime: subscription.expirationTime ?? null,
            } satisfies ChannelData['push'],
          })
          .where(eq(TABLE.userChannels.id, existingChannel.id))

        logger.info('Push subscription updated', {
          userId,
          channelId: existingChannel.id,
        })

        return c.json({ id: existingChannel.id, updated: true })
      }

      // Create new push subscription
      const channel = await c.var.db
        .insert(TABLE.userChannels)
        .values({
          user_id: userId,
          channel: 'push',
          target: subscription.endpoint,
          data: {
            auth: subscription.keys.auth,
            p256dh: subscription.keys.p256dh,
            expirationTime: subscription.expirationTime ?? null,
          } satisfies ChannelData['push'],
          status: 'verified', // Push subscriptions are verified by the browser
          verified_at: new Date(),
        })
        .returning({ id: TABLE.userChannels.id })
        .then((channels) => channels.at(0))

      if (!channel) {
        return c.json({ error: 'Failed to create push subscription' }, 500)
      }

      logger.info('Push subscription created', {
        userId,
        channelId: channel.id,
      })

      return c.json({ id: channel.id }, 201)
    },
  )
