import { vValidator } from '@hono/valibot-validator'
import { and, eq, gt } from 'drizzle-orm'
import * as v from 'valibot'
import { requireAuth } from '#app/middleware/auth.js'
import { injectDb } from '#app/middleware/database.js'
import { createApp } from '#app/middleware/hono.js'
import { TABLE } from '#core/database/index.js'
import { sendVerificationEmail } from '#services/email/verification.js'
import { sendWelcomeEmail } from '#services/email/welcome.js'
import {
  checkAndConsumeEmailVerificationRateLimit,
  formatEmailVerificationRateLimitError,
  normalizeEmailForRateLimit,
} from '#services/notifications/email-verification-rate-limit.js'
import { generateToken } from '#services/notifications/helpers.js'
import { addContactToList } from '#services/sendgrid/contacts.js'
import { logger } from '#utils/logger.js'

export const addEmailChannelBodySchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.minLength(1), v.email()),
})

export const verifyEmailChannelBodySchema = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
})

export default createApp()
  .basePath('/email')
  .post(
    '/',
    ...requireAuth,
    injectDb,
    vValidator('json', addEmailChannelBodySchema),
    async (c) => {
      const userId = c.var.user_id
      const { email: rawEmail } = c.req.valid('json')
      const email = normalizeEmailForRateLimit(rawEmail)

      // Check if email is already linked to this user
      const existingChannel = await c.var.db.query.userChannels.findFirst({
        where: and(
          eq(TABLE.userChannels.user_id, userId),
          eq(TABLE.userChannels.channel, 'email'),
          eq(TABLE.userChannels.target, email),
        ),
      })

      if (existingChannel) {
        if (existingChannel.status === 'verified') {
          return c.json(
            { error: 'Email already verified for this account' },
            400,
          )
        }
        // If pending, we can resend verification
      }

      // Check if email is linked to another user
      const otherUserChannel = await c.var.db.query.userChannels.findFirst({
        where: and(
          eq(TABLE.userChannels.channel, 'email'),
          eq(TABLE.userChannels.target, email),
          eq(TABLE.userChannels.status, 'verified'),
        ),
      })

      if (otherUserChannel && otherUserChannel.user_id !== userId) {
        return c.json(
          { error: 'This email address is already linked to another account' },
          400,
        )
      }

      // Upsert the channel
      const channel = await c.var.db
        .insert(TABLE.userChannels)
        .values({
          user_id: userId,
          channel: 'email',
          status: 'pending',
          target: email,
        })
        .onConflictDoUpdate({
          target: [
            TABLE.userChannels.user_id,
            TABLE.userChannels.channel,
            TABLE.userChannels.target,
          ],
          set: {
            status: 'pending',
            last_verification_sent_at: new Date(),
          },
        })
        .returning({
          id: TABLE.userChannels.id,
        })
        .then((channels) => channels.at(0))

      if (!channel) {
        return c.json({ error: 'Failed to create channel' }, 500)
      }

      // Create verification token
      const verification = await c.var.db
        .insert(TABLE.channelVerifications)
        .values({
          user_id: userId,
          channel_id: channel.id,
          channel: 'email',
          purpose: 'verify',
          token: generateToken(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          attempts: 0,
        })
        .returning({
          id: TABLE.channelVerifications.id,
          token: TABLE.channelVerifications.token,
          expires_at: TABLE.channelVerifications.expires_at,
        })
        .then((verifications) => verifications.at(0))

      if (!verification) {
        return c.json({ error: 'Failed to create verification' }, 500)
      }

      const rateLimit = await checkAndConsumeEmailVerificationRateLimit(
        c.env.KV,
        email,
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

      // Send verification email
      const emailResult = await sendVerificationEmail(
        c.env.SENDGRID_API_KEY,
        c.env.EMAIL_FROM_ADDRESS,
        email,
        verification.token,
        c.env.MANAGER_APP_URL,
      )

      if (emailResult.isErr()) {
        logger.error('Failed to send verification email', {
          channelId: channel.id,
          email,
          error: emailResult.error,
        })
        return c.json({ error: 'Failed to send verification email' }, 500)
      }

      logger.info('Verification email sent', {
        channelId: channel.id,
        email,
      })

      return c.json({
        message: 'Verification email sent',
        expires_at: verification.expires_at,
        channelId: channel.id,
      })
    },
  )
  .post(
    '/verify',
    vValidator('json', verifyEmailChannelBodySchema),
    injectDb,
    async (c) => {
      const { token } = c.req.valid('json')

      const verification = await c.var.db.query.channelVerifications.findFirst({
        where: and(
          eq(TABLE.channelVerifications.token, token),
          eq(TABLE.channelVerifications.purpose, 'verify'),
          gt(TABLE.channelVerifications.expires_at, new Date()),
        ),
        with: {
          channel: true,
        },
      })

      if (!verification) {
        return c.json({ error: 'Invalid or expired verification token' }, 400)
      }

      // Mark channel as verified
      await c.var.db
        .update(TABLE.userChannels)
        .set({
          status: 'verified',
          verified_at: new Date(),
        })
        .where(eq(TABLE.userChannels.id, verification.channel_id))

      // Delete the verification record
      await c.var.db
        .delete(TABLE.channelVerifications)
        .where(eq(TABLE.channelVerifications.id, verification.id))

      // Send welcome email if target exists
      if (verification.channel?.target) {
        const welcomeResult = await sendWelcomeEmail(
          c.env.SENDGRID_API_KEY,
          c.env.EMAIL_FROM_ADDRESS,
          verification.channel.target,
          c.env.MANAGER_APP_URL,
        )

        if (welcomeResult.isErr()) {
          // Log error but don't fail the verification
          logger.error('Failed to send welcome email', {
            channelId: verification.channel_id,
            email: verification.channel.target,
            error: welcomeResult.error,
          })
        } else {
          logger.info('Welcome email sent', {
            channelId: verification.channel_id,
            email: verification.channel.target,
          })
        }
      }

      // broadcast list sync via waitUntil
      if (c.env.SENDGRID_BROADCAST_LIST_ID && verification.channel?.target) {
        c.executionCtx.waitUntil(
          Promise.resolve(
            addContactToList(
              {
                SENDGRID_API_KEY: c.env.SENDGRID_API_KEY,
                SENDGRID_BROADCAST_LIST_ID: c.env.SENDGRID_BROADCAST_LIST_ID,
              },
              verification.channel.target,
              verification.user_id,
            ),
          ).then((result) => {
            if (result.isErr()) {
              logger.error('Failed to add contact to broadcast list', {
                email: verification.channel?.target,
                error: result.error,
              })
            } else {
              logger.info('Added contact to broadcast list', {
                email: verification.channel?.target,
                jobId: result.value.jobId,
              })
            }
          }),
        )
      }

      return c.json({ message: 'Email verified successfully' })
    },
  )
