import { TelegramAuthSchema } from '@ens-apps/shared-schema/telegram'
import { vValidator } from '@hono/valibot-validator'
import { and, eq } from 'drizzle-orm'
import { match, P } from 'ts-pattern'
import * as v from 'valibot'
import { requireAuth } from '#app/middleware/auth.js'
import { injectDb } from '#app/middleware/database.js'
import { createApp } from '#app/middleware/hono.js'
import { intoDbResult, TABLE } from '#core/database/index.js'
import { verifyTelegramAuth } from '#services/telegram/auth.js'
import {
  createInlineKeyboard,
  makeTelegramRequest,
} from '#services/telegram/utils.js'
import { logger } from '#utils/logger.js'

export default createApp()
  .basePath('/telegram')
  .post(
    '/',
    ...requireAuth,
    injectDb,
    vValidator(
      'json',
      v.object({
        auth_data: TelegramAuthSchema,
      }),
    ),
    async (c) => {
      const userId = c.var.user_id
      const { auth_data } = c.req.valid('json')

      const authResult = await verifyTelegramAuth(
        c.env.TELEGRAM_BOT_TOKEN,
        auth_data,
      )
      if (authResult.isErr()) {
        switch (authResult.error.code) {
          case 'TELEGRAM_AUTH_DATA_EXPIRED':
            return c.json({ error: 'Telegram auth data expired' }, 400)
          case 'TELEGRAM_AUTH_DATA_HASH_MISMATCH':
            return c.json({ error: 'Telegram auth data hash mismatch' }, 400)
          default:
            return c.json({ error: 'Failed to verify Telegram auth data' }, 400)
        }
      }

      const existingChannel = await c.var.db.query.userChannels.findFirst({
        where: and(
          eq(TABLE.userChannels.user_id, userId),
          eq(TABLE.userChannels.channel, 'telegram'),
          eq(TABLE.userChannels.target, auth_data.id.toString()),
        ),
      })

      if (existingChannel) {
        return c.json({ error: 'Channel already exists' }, 400)
      }

      const channel = await c.var.db
        .insert(TABLE.userChannels)
        .values({
          user_id: userId,
          channel: 'telegram',
          status: 'verified',
          verified_at: new Date(),
          target: auth_data.id.toString(),
          data: {
            username: auth_data.username,
          },
        })
        .returning({
          id: TABLE.userChannels.id,
        })
        .then((channels) => channels.at(0))

      if (!channel) {
        return c.json({ error: 'Failed to create channel' }, 400)
      }

      const preferencesUrl = `${c.env.MANAGER_APP_URL}/notifications/settings`
      const keyboard = createInlineKeyboard([
        [
          {
            text: '⚙️ Manage Notification Preferences',
            url: preferencesUrl,
          },
        ],
      ])

      const messageResult = await makeTelegramRequest(
        c.env.TELEGRAM_BOT_TOKEN,
        'sendMessage',
        {
          chat_id: auth_data.id,
          text:
            '🎉 *Welcome to ENS Notifications!*\n\n' +
            "Your Telegram has been successfully connected and you're all set to receive notifications about your ENS domains.\n\n" +
            "You'll receive updates about:\n\n" +
            '• Domain expiry reminders\n' +
            '• Domain transfers\n' +
            '• And other important events\n\n' +
            'You can customize which notifications you receive at any time from your notification settings.\n\n' +
            '👥 *Want more ENS news & updates?*\n' +
            'Join our announcements group for broadcasts: [t.me/ens_updates](https://t.me/ens_updates)',
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        },
      )

      if (messageResult.isErr())
        return match(messageResult.error)
          .with(
            { code: 'TELEGRAM_API_REQUEST_ERROR', errorCode: 403 },
            async (e) => {
              logger.warn(
                'Telegram bot is not authorized to send messages to this user',
                {
                  channelId: channel.id,
                  userId,
                  error: e,
                },
              )

              const updateResult = await intoDbResult(
                c.var.db
                  .update(TABLE.userChannels)
                  .set({
                    status: 'pending',
                    status_reason: 'FORBIDDEN_BY_TELEGRAM',
                  })
                  .where(eq(TABLE.userChannels.id, channel.id)),
              )

              if (updateResult.isErr()) {
                logger.error('Failed to update user channel status', {
                  channelId: channel.id,
                  userId,
                  error: updateResult.error,
                })
                return c.json(
                  { error: 'Failed to mark channel as pending' },
                  500,
                )
              }

              return c.json({ ok: true })
            },
          )
          .with(
            {
              code: P.union(
                'TELEGRAM_API_RESPONSE_PARSE_ERROR',
                'TELEGRAM_API_REQUEST_ERROR',
              ),
            },
            (e) => {
              logger.error(
                'Failed to send telegram message on channel creation',
                {
                  channelId: channel.id,
                  error: e,
                },
              )
              return c.json({ error: 'Failed to send message' }, 400)
            },
          )
          .exhaustive()
      return c.json({ ok: true })
    },
  )
