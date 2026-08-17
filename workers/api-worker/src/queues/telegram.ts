import { getDatabase } from '#core/database/index.js'
import {
  deliverTelegramNotification,
  handleTelegramDeliveryFailure,
} from '#services/delivery/telegram.js'
import type { TelegramDeliveryJob } from '#types/delivery.js'
import { logger } from '#utils/logger.js'

export const handleTelegramQueue = async (
  batch: MessageBatch<TelegramDeliveryJob>,
  env: CloudflareBindings,
): Promise<void> => {
  const db = getDatabase(env)
  let succeeded = 0
  let failed = 0

  logger.debug('Processing telegram delivery batch', {
    messageCount: batch.messages.length,
  })

  for (const message of batch.messages) {
    const job = message.body

    logger.trace('Processing telegram delivery', {
      jobId: job.id,
      kind: job.kind,
      attempt: message.attempts + 1,
    })

    // Attempt delivery
    const result = await deliverTelegramNotification(
      env.TELEGRAM_BOT_TOKEN,
      db,
      job,
    )

    if (result.isErr()) {
      failed += 1
      logger.warn('Telegram delivery failed, scheduling retry', {
        jobId: job.id,
        error: result.error.message,
        attempt: message.attempts + 1,
      })
      await handleTelegramDeliveryFailure(db, message, result.error.message)
      message.retry()
    } else {
      succeeded += 1
      logger.trace('Telegram delivery succeeded', { jobId: job.id })
      message.ack()
    }
  }

  logger.info('Telegram delivery batch completed', {
    messageCount: batch.messages.length,
    succeeded,
    failed,
  })
}
