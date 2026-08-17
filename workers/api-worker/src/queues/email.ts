import { getDatabase } from '#core/database/index.js'
import {
  deliverEmailNotification,
  handleEmailDeliveryFailure,
} from '#services/delivery/email.js'
import type { EmailDeliveryJob } from '#types/delivery.js'
import { logger } from '#utils/logger.js'

export const handleEmailQueue = async (
  batch: MessageBatch<EmailDeliveryJob>,
  env: CloudflareBindings,
): Promise<void> => {
  const db = getDatabase(env)
  let succeeded = 0
  let failed = 0

  logger.debug('Processing email delivery batch', {
    messageCount: batch.messages.length,
  })

  for (const message of batch.messages) {
    const job = message.body

    logger.trace('Processing email delivery', {
      jobId: job.id,
      kind: job.kind,
      attempt: message.attempts + 1,
    })

    // Attempt delivery
    const result = await deliverEmailNotification(
      env.SENDGRID_API_KEY,
      env.EMAIL_FROM_ADDRESS,
      db,
      job,
    )

    if (result.isErr()) {
      failed += 1
      logger.warn('Email delivery failed, scheduling retry', {
        jobId: job.id,
        error: result.error.message,
        attempt: message.attempts + 1,
      })
      await handleEmailDeliveryFailure(db, message, result.error.message)
      message.retry()
    } else {
      succeeded += 1
      logger.trace('Email delivery succeeded', { jobId: job.id })
      message.ack()
    }
  }

  logger.info('Email delivery batch completed', {
    messageCount: batch.messages.length,
    succeeded,
    failed,
  })
}
