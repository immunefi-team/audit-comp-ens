import { and, eq } from 'drizzle-orm'
import { okAsync } from 'neverthrow'
import { requireAuth } from '#app/middleware/auth.js'
import { injectDb } from '#app/middleware/database.js'
import { createApp } from '#app/middleware/hono.js'
import { TABLE } from '#core/database/index.js'
import { sendVerificationEmail } from '#services/email/verification.js'
import {
  checkAndConsumeEmailVerificationRateLimit,
  formatEmailVerificationRateLimitError,
} from '#services/notifications/email-verification-rate-limit.js'
import {
  generateToken,
  type PublicChannel,
  toPublicChannel,
} from '#services/notifications/helpers.js'
import { deleteContact, searchContact } from '#services/sendgrid/contacts.js'
import { logger } from '#utils/logger.js'

export default createApp()
  .basePath('/:id')
  .get('/', ...requireAuth, injectDb, async (c) => {
    const userId = c.var.user_id
    const channelId = c.req.param('id')

    const channel = await c.var.db.query.userChannels.findFirst({
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
      where: and(
        eq(TABLE.userChannels.user_id, userId),
        eq(TABLE.userChannels.id, channelId),
      ),
    })

    if (!channel) {
      return c.json({ error: 'Channel not found' }, 404)
    }

    const publicChannelResult = await toPublicChannel(channel)

    if (publicChannelResult.isErr()) {
      logger.error('Failed to map public channel response', {
        channelId,
        userId,
        error: publicChannelResult.error,
      })
      return c.json({ error: 'Failed to map channel response' }, 500)
    }

    return c.json<PublicChannel>(publicChannelResult.value)
  })
  .delete('/', ...requireAuth, injectDb, async (c) => {
    const userId = c.var.user_id
    const channelId = c.req.param('id')

    const channel = await c.var.db.query.userChannels.findFirst({
      where: and(
        eq(TABLE.userChannels.id, channelId),
        eq(TABLE.userChannels.user_id, userId),
      ),
    })

    if (!channel) {
      return c.json({ error: 'Channel not found' }, 404)
    }

    await c.var.db
      .delete(TABLE.userChannels)
      .where(eq(TABLE.userChannels.id, channelId))

    // broadcast list cleanup via waitUntil
    if (
      channel.channel === 'email' &&
      channel.target &&
      c.env.SENDGRID_BROADCAST_LIST_ID
    ) {
      const env = {
        SENDGRID_API_KEY: c.env.SENDGRID_API_KEY,
        SENDGRID_BROADCAST_LIST_ID: c.env.SENDGRID_BROADCAST_LIST_ID,
      }
      c.executionCtx.waitUntil(
        Promise.resolve(
          searchContact(env, channel.target).andThen((contact) =>
            contact ? deleteContact(env, contact.id) : okAsync(undefined),
          ),
        ).then((result) => {
          if (result.isErr()) {
            logger.error('Failed to delete contact from SendGrid', {
              email: channel.target,
              error: result.error,
            })
          } else {
            logger.info('Deleted contact from SendGrid', {
              email: channel.target,
            })
          }
        }),
      )
    }

    return c.json({ message: 'Channel deleted successfully' })
  })
  .post('/test', ...requireAuth, injectDb, async (c) => {
    const userId = c.var.user_id
    const channelId = c.req.param('id')

    const channel = await c.var.db.query.userChannels.findFirst({
      where: and(
        eq(TABLE.userChannels.id, channelId),
        eq(TABLE.userChannels.user_id, userId),
      ),
    })

    if (!channel) {
      return c.json({ error: 'Channel not found' }, 404)
    }

    if (channel.status !== 'verified') {
      return c.json(
        { error: 'Channel must be verified to send test notifications' },
        400,
      )
    }

    // TODO: Send test notification based on channel type
    // For now, just update the last_sent_at timestamp
    await c.var.db
      .update(TABLE.userChannels)
      .set({
        last_sent_at: new Date(),
      })
      .where(eq(TABLE.userChannels.id, channelId))

    return c.json({ message: 'Test notification sent successfully' })
  })
  .post('/resend', ...requireAuth, injectDb, async (c) => {
    const userId = c.var.user_id
    const channelId = c.req.param('id')

    const channel = await c.var.db.query.userChannels.findFirst({
      where: and(
        eq(TABLE.userChannels.id, channelId),
        eq(TABLE.userChannels.user_id, userId),
      ),
    })

    if (!channel) {
      return c.json({ error: 'Channel not found' }, 404)
    }

    if (channel.status !== 'pending') {
      return c.json({ error: 'Channel is not pending verification' }, 400)
    }

    if (!channel.target) {
      return c.json({ error: 'Channel has no target address' }, 400)
    }

    if (channel.channel !== 'email') {
      return c.json({ error: 'Only email channels can be resend' }, 400)
    }

    const rateLimit = await checkAndConsumeEmailVerificationRateLimit(
      c.env.KV,
      channel.target,
    )

    if (!rateLimit.isAllowed) {
      return c.json(
        {
          error: formatEmailVerificationRateLimitError(
            rateLimit.retryAfterSeconds,
          ),
        },
        429,
      )
    }

    // Create new verification token
    const verification = await c.var.db
      .insert(TABLE.channelVerifications)
      .values({
        user_id: userId,
        channel_id: channelId,
        channel: channel.channel,
        purpose: 'verify',
        token: generateToken(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        attempts: 0,
      })
      .returning({
        id: TABLE.channelVerifications.id,
        token: TABLE.channelVerifications.token,
      })
      .then((verifications) => verifications.at(0))

    if (!verification) {
      return c.json({ error: 'Failed to create verification' }, 500)
    }

    // Update last verification sent timestamp
    await c.var.db
      .update(TABLE.userChannels)
      .set({
        last_verification_sent_at: new Date(),
      })
      .where(eq(TABLE.userChannels.id, channelId))

    // Send verification email
    const emailResult = await sendVerificationEmail(
      c.env.SENDGRID_API_KEY,
      c.env.EMAIL_FROM_ADDRESS,
      channel.target,
      verification.token,
      c.env.MANAGER_APP_URL,
    )

    if (emailResult.isErr()) {
      // Log error but don't fail the request - user can resend
      logger.error('Failed to send verification email', {
        channelId,
        email: channel.target,
        error: emailResult.error,
      })

      return c.json({ error: 'Failed to send verification email' }, 500)
    } else {
      logger.info('Verification email resent', {
        channelId,
        email: channel.target,
      })
    }

    return c.json({ message: 'Verification sent successfully' })
  })
