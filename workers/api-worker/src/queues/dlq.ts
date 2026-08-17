import type { ChannelType } from '@ens-apps/shared-schema/notifications'
import { eq } from 'drizzle-orm'
import { getQueueForChannel } from '#config/queues.js'
import type { Database } from '#core/database/index.js'
import { getDatabase, TABLE } from '#core/database/index.js'
import type { ClassificationResult } from '#services/delivery/classifier.js'
import { classifyDeliveryError } from '#services/delivery/classifier.js'
import type { BaseDeliveryJob } from '#types/delivery.js'
import { logger } from '#utils/logger.js'

const MAX_DLQ_ATTEMPTS = 3

export const handleDlqQueue = async (
  batch: MessageBatch<BaseDeliveryJob>,
  env: CloudflareBindings,
): Promise<void> => {
  const db = getDatabase(env)

  for (const message of batch.messages) {
    const job = message.body

    try {
      await processDlqMessage(db, env, job)
    } catch (err) {
      logger.error('DLQ processing error', {
        deliveryId: job.id,
        error: err,
      })
    }

    // always ack. DLQ handler must never retry itself
    message.ack()
  }
}

async function processDlqMessage(
  db: Database,
  env: CloudflareBindings,
  job: BaseDeliveryJob,
): Promise<void> {
  // 1. look up delivery record
  const delivery = await db.query.notificationDeliveries.findFirst({
    where: eq(TABLE.notificationDeliveries.id, job.id),
    columns: {
      id: true,
      channel: true,
      target: true,
      error: true,
      dlq_attempts: true,
    },
  })

  if (!delivery) {
    logger.warn('DLQ: delivery record not found, skipping', {
      deliveryId: job.id,
    })
    return
  }

  // 2. classify the error
  const errorString = delivery.error ?? 'unknown error'
  const classification = classifyDeliveryError(delivery.channel, errorString)

  const dlqAttempts = delivery.dlq_attempts ?? 0

  // 3. check DLQ budget
  if (
    dlqAttempts >= MAX_DLQ_ATTEMPTS &&
    (classification.category === 'transient' ||
      classification.category === 'rate_limit')
  ) {
    await db
      .update(TABLE.notificationDeliveries)
      .set({
        status: 'permanently_failed',
        failure_category: classification.category,
        updated_at: new Date(),
      })
      .where(eq(TABLE.notificationDeliveries.id, job.id))

    logger.warn('DLQ: max replay attempts exceeded', {
      deliveryId: job.id,
      channel: delivery.channel,
      category: classification.category,
      dlqAttempts,
    })
    return
  }

  // 4. branch on category
  switch (classification.category) {
    case 'transient':
    case 'rate_limit': {
      await requeue(db, env, job, delivery, classification, dlqAttempts)
      break
    }

    case 'hard_bounce': {
      await handleHardBounce(db, job, delivery, classification)
      break
    }

    case 'account_error': {
      await db
        .update(TABLE.notificationDeliveries)
        .set({
          status: 'permanently_failed',
          failure_category: 'account_error',
          updated_at: new Date(),
        })
        .where(eq(TABLE.notificationDeliveries.id, job.id))

      logger.error('DLQ_ACCOUNT_ERROR', {
        deliveryId: job.id,
        channel: delivery.channel,
        target: delivery.target,
        error: errorString,
      })
      break
    }

    case 'unknown':
    default: {
      await db
        .update(TABLE.notificationDeliveries)
        .set({
          status: 'permanently_failed',
          failure_category: 'unknown',
          updated_at: new Date(),
        })
        .where(eq(TABLE.notificationDeliveries.id, job.id))

      logger.error('DLQ_MANUAL_REVIEW', {
        deliveryId: job.id,
        channel: delivery.channel,
        target: delivery.target,
        error: errorString,
      })
      break
    }
  }
}

async function requeue(
  db: Database,
  env: CloudflareBindings,
  job: BaseDeliveryJob,
  delivery: { id: string; channel: string; target: string },
  classification: ClassificationResult,
  dlqAttempts: number,
): Promise<void> {
  const delaySeconds = classification.delaySeconds ?? 3600

  await db
    .update(TABLE.notificationDeliveries)
    .set({
      status: 'queued',
      failure_category: classification.category,
      dlq_attempts: dlqAttempts + 1,
      updated_at: new Date(),
    })
    .where(eq(TABLE.notificationDeliveries.id, job.id))

  const queueBinding = getQueueForChannel(delivery.channel as ChannelType)

  if (!queueBinding) {
    logger.error('DLQ: no queue binding for channel', {
      deliveryId: job.id,
      channel: delivery.channel,
    })
    return
  }

  const queue = env[queueBinding] as Queue<BaseDeliveryJob>
  await queue.send(job, { delaySeconds })

  logger.info('DLQ: re-queued delivery', {
    deliveryId: job.id,
    channel: delivery.channel,
    category: classification.category,
    delaySeconds,
    dlqAttempt: dlqAttempts + 1,
  })
}

async function handleHardBounce(
  db: Database,
  job: BaseDeliveryJob,
  delivery: { id: string; channel: string; target: string },
  classification: ClassificationResult,
): Promise<void> {
  await db
    .update(TABLE.notificationDeliveries)
    .set({
      status: 'permanently_failed',
      failure_category: classification.category,
      updated_at: new Date(),
    })
    .where(eq(TABLE.notificationDeliveries.id, job.id))

  // mark channel as bounced, prevents future sends. only status='verified' channels are queried
  await db
    .update(TABLE.userChannels)
    .set({
      status: 'bounced',
      status_reason: `Hard bounce: ${delivery.channel}`,
      last_bounce_at: new Date(),
    })
    .where(eq(TABLE.userChannels.target, delivery.target))

  logger.warn('DLQ: hard bounce — channel marked as bounced', {
    deliveryId: job.id,
    channel: delivery.channel,
    target: delivery.target,
  })
}
