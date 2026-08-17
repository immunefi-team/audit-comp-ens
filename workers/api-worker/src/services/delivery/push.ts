import { buildPushPayload } from '@block65/webcrypto-web-push'
import type { AnyPersonalNotificationPayload } from '@ens-apps/shared-schema/notifications'
import { ResultFn } from '@ens-apps/utils/neverthrow'
import { eq } from 'drizzle-orm'
import { ok } from 'neverthrow'
import type { Database } from '#core/database/index.js'
import { TABLE } from '#core/database/index.js'
import type { PushDeliveryJob } from '#types/delivery.js'
import { logger } from '#utils/logger.js'
import {
  NotificationDeliveryNotFoundError,
  PushDeliveryError,
  UnsupportedNotificationTypeError,
} from './errors.js'
import { type PushTemplate, pushTemplates } from './templates/push.js'

type PushChannelData = {
  auth: string
  p256dh: string
  expirationTime?: number | null
}

export const deliverPushNotification = ResultFn(async function* (
  env: {
    VAPID_SUBJECT: string
    VAPID_PUBLIC_KEY: string
    VAPID_PRIVATE_KEY: string
  },
  db: Database,
  job: PushDeliveryJob,
) {
  // 1. get delivery record with notification payload
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

  // 2. get channel data (which are encryption keys)
  const channel = await db.query.userChannels.findFirst({
    where: eq(TABLE.userChannels.target, deliveryJob.target),
    columns: {
      data: true,
    },
  })

  if (!channel?.data) {
    return yield* new NotificationDeliveryNotFoundError({
      message: `Push channel not found for target: ${deliveryJob.target}`,
    })
  }

  const channelData = channel.data as PushChannelData

  // 3. get the template
  const template = pushTemplates[job.kind] as PushTemplate<typeof job.kind>
  if (!template) {
    return yield* new UnsupportedNotificationTypeError({
      message: `No Push template for: ${job.kind}`,
    })
  }

  // 4. generate notification content
  const notificationData = template(
    deliveryJob.notification.payload as AnyPersonalNotificationPayload,
  )

  // 5. build the Web Push subscription object
  const subscription = {
    endpoint: deliveryJob.target,
    expirationTime: channelData.expirationTime ?? null,
    keys: {
      auth: channelData.auth,
      p256dh: channelData.p256dh,
    },
  }

  // 6. build encrypted payload
  const payload = await buildPushPayload(
    {
      data: notificationData,
      options: {
        topic: job.kind,
        ttl: 86400, // 24 hours
        urgency: 'normal' as const,
      },
    },
    subscription,
    {
      subject: env.VAPID_SUBJECT,
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    },
  )

  // 7. send to push service
  const response = await fetch(subscription.endpoint, payload)

  if (!response.ok) {
    const errorText = await response.text()

    // handle expired subscriptions (410 Gone)
    if (response.status === 410) {
      await db
        .update(TABLE.userChannels)
        .set({
          status: 'unsubscribed',
          status_reason: 'Push subscription expired',
        })
        .where(eq(TABLE.userChannels.target, deliveryJob.target))

      logger.warn('Push subscription expired, marked as unsubscribed', {
        jobId: job.id,
        endpoint: `${deliveryJob.target.substring(0, 50)}...`,
      })
    }

    return yield* new PushDeliveryError({
      message: `Push delivery failed: ${response.status} ${errorText}`,
    })
  }

  // 8. update delivery record
  await db
    .update(TABLE.notificationDeliveries)
    .set({
      status: 'delivered',
      provider_msg_id: response.headers.get('location') || `push-${Date.now()}`,
      updated_at: new Date(),
    })
    .where(eq(TABLE.notificationDeliveries.id, job.id))

  logger.debug('Push notification delivered', {
    jobId: job.id,
    kind: job.kind,
    endpoint: `${deliveryJob.target.substring(0, 50)}...`,
  })

  return ok(undefined)
})

export const handlePushDeliveryFailure = async (
  db: Database,
  message: Message<PushDeliveryJob>,
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

  logger.error('Push notification failed', {
    jobId: message.body.id,
    kind: message.body.kind,
    attempts: message.attempts + 1,
    error: errorMessage,
  })
}
