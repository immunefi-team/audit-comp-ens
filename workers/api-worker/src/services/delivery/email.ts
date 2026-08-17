import type { AnyPersonalNotificationPayload } from '@ens-apps/shared-schema/notifications'
import { ResultFn } from '@ens-apps/utils/neverthrow'
import { eq } from 'drizzle-orm'
import { ok } from 'neverthrow'
import type { Database } from '#core/database/index.js'
import { TABLE } from '#core/database/index.js'
import { sendMailV3 } from '#services/email/utils.js'
import type { EmailDeliveryJob } from '#types/delivery.js'
import { logger } from '#utils/logger.js'
import {
  NotificationDeliveryNotFoundError,
  UnsupportedNotificationTypeError,
} from './errors.js'
import { type EmailTemplate, emailTemplates } from './templates/email.js'

export const deliverEmailNotification = ResultFn(async function* (
  apiKey: string,
  fromEmail: string,
  db: Database,
  job: EmailDeliveryJob,
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
  const template = emailTemplates[job.kind] as EmailTemplate<typeof job.kind>
  if (!template) {
    return yield* new UnsupportedNotificationTypeError({
      message: `No Email template for: ${job.kind}`,
    })
  }

  // Generate the template data
  const templateData = template(
    deliveryJob.notification.payload as AnyPersonalNotificationPayload,
  )

  if (!templateData.templateId) {
    return yield* new UnsupportedNotificationTypeError({
      message: `Missing template ID for: ${job.kind}`,
    })
  }

  // Send via SendGrid API
  const result = yield* sendMailV3(apiKey, {
    personalizations: [
      {
        to: [
          {
            email: deliveryJob.target,
          },
        ],
        // biome-ignore lint/suspicious/noExplicitAny: template data contains non-string values (numbers, booleans) that SendGrid handles at runtime, but its types expect Record<string, string>
        dynamic_template_data: templateData.dynamicData as any,
      },
    ],
    from: { email: fromEmail },
    subject: templateData.subject,
    template_id: templateData.templateId,
  })

  // Update delivery record
  // SendGrid doesn't return a message_id in the response, but we can use the timestamp or a generated ID
  // For now, we'll use the status code and timestamp as a unique identifier
  const providerMsgId = `${result.statusCode}-${Date.now()}`

  await db
    .update(TABLE.notificationDeliveries)
    .set({
      status: 'delivered',
      provider_msg_id: providerMsgId,
      updated_at: new Date(),
    })
    .where(eq(TABLE.notificationDeliveries.id, job.id))

  logger.debug('Email notification delivered', {
    jobId: job.id,
    kind: job.kind,
    templateId: templateData.templateId,
    to: deliveryJob.target,
  })

  return ok(undefined)
})

export const handleEmailDeliveryFailure = async (
  db: Database,
  message: Message<EmailDeliveryJob>,
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

  logger.error('Email notification failed', {
    jobId: message.body.id,
    kind: message.body.kind,
    attempts: message.attempts + 1,
    error: errorMessage,
  })
}
