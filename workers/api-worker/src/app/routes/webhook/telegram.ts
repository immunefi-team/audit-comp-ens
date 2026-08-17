import { ResultFn } from '@ens-apps/utils/neverthrow'
import type { Update } from '@grammyjs/types'
import { and, eq, inArray } from 'drizzle-orm'
import { ok } from 'neverthrow'
import { injectDb } from '#app/middleware/database.js'
import { createApp } from '#app/middleware/hono.js'
import { type Database, intoDbResult, TABLE } from '#core/database/index.js'
import {
  createInlineKeyboard,
  makeTelegramRequest,
} from '#services/telegram/utils.js'
import { logger } from '#utils/logger.js'

const onMessage = ResultFn(async function* ({
  message,
  db,
  env,
}: {
  message: NonNullable<Update['message']>
  db: Database
  env: CloudflareBindings
}) {
  if (message.text === '/start') {
    const telegramUserId = message.from?.id
    if (!telegramUserId) {
      return ok(undefined)
    }

    const telegramChannels = yield* intoDbResult(
      db.query.userChannels.findMany({
        where: and(
          eq(TABLE.userChannels.channel, 'telegram'),
          eq(TABLE.userChannels.target, telegramUserId.toString()),
        ),
        columns: {
          id: true,
          user_id: true,
          status: true,
        },
      }),
    )

    if (telegramChannels.length === 0) {
      yield* makeTelegramRequest(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
        chat_id: telegramUserId,
        text: "You haven't added your Telegram to the ENS App yet.",
        reply_markup: createInlineKeyboard([
          [
            {
              text: 'Open ENS App',
              url: `${env.MANAGER_APP_URL}/notifications/settings`,
            },
          ],
        ]),
      })

      return ok(undefined)
    }

    // If any pending channels then mark them as verified and send a message to the user
    if (telegramChannels.some((channel) => channel.status === 'pending')) {
      yield* intoDbResult(
        db
          .update(TABLE.userChannels)
          .set({ status: 'verified' })
          .where(
            and(
              inArray(
                TABLE.userChannels.id,
                telegramChannels.map((channel) => channel.id),
              ),
              eq(TABLE.userChannels.status, 'pending'),
              eq(TABLE.userChannels.channel, 'telegram'),
              eq(TABLE.userChannels.target, telegramUserId.toString()),
            ),
          ),
      )

      yield* makeTelegramRequest(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
        chat_id: telegramUserId,
        text: 'Your channels have been verified, you will now receive notifications from ENS.',
      })

      return ok(undefined)
    }

    // If no pending channels then send a message to the user
    yield* makeTelegramRequest(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
      chat_id: telegramUserId,
      text: "You've already verified your Telegram for notifications.",
    })

    return ok(undefined)
  }

  return ok(undefined)
})

export default createApp()
  .basePath('/telegram')
  .post('/update', injectDb, async (c) => {
    const webhookSecretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token')

    if (!webhookSecretToken) {
      return c.json({ message: 'Unauthorized' }, 401)
    }

    if (webhookSecretToken !== c.env.TELEGRAM_WEBHOOK_SECRET) {
      return c.json({ message: 'Unauthorized' }, 401)
    }

    const update = (await c.req.json()) as Update

    // If is start message then verify user
    if (update.message !== undefined) {
      const result = await onMessage({
        message: update.message,
        db: c.var.db,
        env: c.env,
      })
      if (result.isErr()) {
        logger.error('Error processing Telegram message', {
          error: result.error,
          message: update.message,
        })
      }
    }

    return c.json({ message: 'OK' })
  })
