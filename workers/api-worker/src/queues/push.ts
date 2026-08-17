import { getDatabase } from '#core/database/index.js'
import {
  deliverPushNotification,
  handlePushDeliveryFailure,
} from '#services/delivery/push.js'
import type { PushDeliveryJob } from '#types/delivery.js'
import { logger } from '#utils/logger.js'

export const handlePushQueue = async (
  batch: MessageBatch<PushDeliveryJob>,
  env: CloudflareBindings,
): Promise<void> => {
  const db = getDatabase(env)
  let succeeded = 0
  let failed = 0

  logger.debug('Processing push delivery batch', {
    messageCount: batch.messages.length,
  })

  for (const message of batch.messages) {
    const job = message.body

    logger.trace('Processing push delivery', {
      jobId: job.id,
      kind: job.kind,
      attempt: message.attempts + 1,
    })

    // attempt delivery
    const result = await deliverPushNotification(
      {
        VAPID_SUBJECT: env.VAPID_SUBJECT,
        VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY: env.VAPID_PRIVATE_KEY,
      },
      db,
      job,
    )

    if (result.isErr()) {
      failed += 1
      logger.warn('Push delivery failed, scheduling retry', {
        jobId: job.id,
        error: result.error.message,
        attempt: message.attempts + 1,
      })
      await handlePushDeliveryFailure(db, message, result.error.message)
      message.retry()
    } else {
      succeeded += 1
      logger.trace('Push delivery succeeded', { jobId: job.id })
      message.ack()
    }
  }

  logger.info('Push delivery batch completed', {
    messageCount: batch.messages.length,
    succeeded,
    failed,
  })
}
