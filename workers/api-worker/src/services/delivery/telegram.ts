import type { AnyPersonalNotificationPayload } from '@ens-apps/shared-schema/notifications'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { eq } from 'drizzle-orm'
import { ok } from 'neverthrow'
import type { Database } from '#core/database/index.js'
import { TABLE } from '#core/database/index.js'
import {
  createInlineKeyboard,
  makeTelegramRequest,
} from '#services/telegram/utils.js'
import type { TelegramDeliveryJob } from '#types/delivery.js'
import { logger } from '#utils/logger.js'
import { NotificationDeliveryNotFoundError } from './errors.js'
import {
  type TelegramTemplate,
  telegramTemplates,
} from './templates/telegram.js'

class UnsupportedNotificationTypeError extends TaggedError(
  'UNSUPPORTED_NOTIFICATION_TYPE',
) {}

export const deliverTelegramNotification = ResultFn(async function* (
  botToken: string,
  db: Database,
  job: TelegramDeliveryJob,
) {
  const deliveryJob = await db.query.notificationDeliveries.findFirst({
    where: eq(TABLE.notificationDeliveries.id, job.id),
    columns: {
      target: true,
    },
    with: {
      notification: {
        columns: {
          payload: true,
        },
      },
    },
  })

  if (!deliveryJob) {
    return yield* new NotificationDeliveryNotFoundError({
      message: `Delivery job not found: ${job.id}`,
    })
  }
  // Get the template function
  const template = telegramTemplates[job.kind] as TelegramTemplate<
    typeof job.kind
  >
  if (!template) {
    return yield* new UnsupportedNotificationTypeError({
      message: `No Telegram template for: ${job.kind}`,
    })
  }

  // Generate the message
  const message = template(
    deliveryJob.notification.payload as AnyPersonalNotificationPayload,
  )

  // Create keyboard if buttons exist
  const replyMarkup = message.buttons
    ? createInlineKeyboard(message.buttons)
    : undefined

  // Send via Telegram API
  const result = yield* makeTelegramRequest(botToken, 'sendMessage', {
    chat_id: deliveryJob.target,
    text: message.text,
    parse_mode: message.parseMode,
    reply_markup: replyMarkup,
  })

  // Update delivery record
  await db
    .update(TABLE.notificationDeliveries)
    .set({
      status: 'delivered',
      provider_msg_id: result.message_id.toString(),
      updated_at: new Date(),
    })
    .where(eq(TABLE.notificationDeliveries.id, job.id))

  logger.debug('Telegram notification delivered', {
    jobId: job.id,
    kind: job.kind,
    messageId: result.message_id,
  })

  return ok(undefined)
})

export const handleTelegramDeliveryFailure = async (
  db: Database,
  message: Message<TelegramDeliveryJob>,
  errorMessage: string,
): Promise<void> => {
  await db
    .update(TABLE.notificationDeliveries)
    .set({
      status: 'failed',
      error: errorMessage,
      attempts: message.attempts + 1,
      updated_at: new Date(),
    })
    .where(eq(TABLE.notificationDeliveries.id, message.body.id))

  logger.error('Telegram notification failed', {
    jobId: message.body.id,
    kind: message.body.kind,
    attempts: message.attempts + 1,
    error: errorMessage,
  })
}
