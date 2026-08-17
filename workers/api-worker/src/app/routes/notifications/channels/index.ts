import { eq } from 'drizzle-orm'
import { requireAuth } from '#app/middleware/auth.js'
import { injectDb } from '#app/middleware/database.js'
import { createApp } from '#app/middleware/hono.js'
import { TABLE } from '#core/database/index.js'
import {
  type PublicChannel,
  type QueryChannelRow,
  toPublicChannel,
} from '#services/notifications/helpers.js'
import { logger } from '#utils/logger.js'
import idRoutes from './$id.js'
import emailRoutes from './email.js'
import pushRoutes from './push.js'
import telegramRoutes from './telegram.js'

/**
 * Notification channel routes for managing delivery contacts.
 *
 * This module handles channel listing and channel-specific sub-routes
 * (email, telegram, push, and id-based operations) for the authenticated user.
 */
export default createApp()
  .basePath('/channels')
  /**
   * GET /channels
   *
   * Retrieves all notification channels for the authenticated user.
   */
  .get('/', ...requireAuth, injectDb, async (c) => {
    const userId = c.var.user_id

    const channels = await c.var.db.query.userChannels.findMany({
      columns: {
        id: true,
        channel: true,
        target: true,
        data: true,
        status: true,
        status_reason: true,
        verified_at: true,
        last_sent_at: true,
        last_bounce_at: true,
        last_verification_sent_at: true,
      },
      where: eq(TABLE.userChannels.user_id, userId),
    })

    const publicChannels = await mapPublicChannels(channels)

    return c.json<PublicChannel[]>(publicChannels)
  })
  .route('/', emailRoutes)
  .route('/', telegramRoutes)
  .route('/', pushRoutes)
  .route('/', idRoutes)

export const mapPublicChannels = async (channels: QueryChannelRow[]) => {
  const mappedChannels = await Promise.all(
    channels.map(async (channel) => ({
      channel,
      mapped: await toPublicChannel(channel),
    })),
  )

  return mappedChannels.flatMap(({ channel, mapped }) => {
    if (mapped.isErr()) {
      logger.warn('Failed to map channel to public representation', {
        channelId: channel.id,
        channelType: channel.channel,
        errorTag: mapped.error._tag,
        errorMessage: mapped.error.message,
      })
      return []
    }

    return [mapped.value]
  })
}
