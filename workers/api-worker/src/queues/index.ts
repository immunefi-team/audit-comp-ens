import type {
  BaseDeliveryJob,
  EmailDeliveryJob,
  PushDeliveryJob,
  TelegramDeliveryJob,
} from '#types/delivery.js'
import { logger } from '#utils/logger.js'
import { handleDlqQueue } from './dlq.js'
import { handleEmailQueue } from './email.js'
import { handleEventIngestionQueue } from './event-ingestion.js'
import { handlePushQueue } from './push.js'
import { handleTelegramQueue } from './telegram.js'

export const handleQueue = async (
  batch: MessageBatch,
  env: CloudflareBindings,
): Promise<void> => {
  logger.debug('Queue batch received', {
    queue: batch.queue,
    messageCount: batch.messages.length,
  })

  // Route to appropriate queue handler based on queue name
  switch (batch.queue) {
    case 'app-api-worker-telegram-delivery':
      await handleTelegramQueue(batch as MessageBatch<TelegramDeliveryJob>, env)
      break
    case 'app-api-worker-email-delivery':
      await handleEmailQueue(batch as MessageBatch<EmailDeliveryJob>, env)
      break
    case 'app-api-worker-push-delivery':
      await handlePushQueue(batch as MessageBatch<PushDeliveryJob>, env)
      break
    case 'app-api-worker-event-ingestion':
      await handleEventIngestionQueue(batch, env)
      break
    case 'app-api-worker-dlq':
      await handleDlqQueue(batch as MessageBatch<BaseDeliveryJob>, env)
      break
    default:
      logger.error('Unknown queue', { queue: batch.queue })
  }
}
