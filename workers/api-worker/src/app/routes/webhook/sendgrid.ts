import { fromSync, ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { eq } from 'drizzle-orm'
import { fromPromise, ok } from 'neverthrow'
import * as v from 'valibot'
import { createApp } from '#app/middleware/hono.js'
import { type Database, getDatabase, TABLE } from '#core/database/index.js'
import { logger } from '#utils/logger.js'

// SendGrid event types we care about
const SendGridEventSchema = v.object({
  email: v.string(),
  event: v.union([
    v.literal('bounce'),
    v.literal('dropped'),
    v.literal('spamreport'),
    v.literal('unsubscribe'),
    v.literal('group_unsubscribe'),
  ]),
  timestamp: v.number(),
  reason: v.optional(v.string()),
  type: v.optional(v.string()), // bounce type
  sg_event_id: v.optional(v.string()),
  sg_message_id: v.optional(v.string()),
})

const SendGridWebhookPayloadSchema = v.array(SendGridEventSchema)

const SendGridWebhookRawBodySchema = v.pipe(
  v.string(),
  v.parseJson(),
  SendGridWebhookPayloadSchema,
)

class SignatureVerificationError extends TaggedError(
  'SIGNATURE_VERIFICATION_ERROR',
) {}

class VerificationKeyConfigurationError extends TaggedError(
  'VERIFICATION_KEY_CONFIGURATION_ERROR',
)<{
  cause: unknown
}> {}

const importVerificationKey = ResultFn(async function* (publicKey: string) {
  const keyData = yield* fromSync(
    () => Uint8Array.from(atob(publicKey), (c) => c.charCodeAt(0)),
    (cause) =>
      new VerificationKeyConfigurationError({
        message: 'Invalid base64 encoding',
        cause,
      }),
  )

  const cryptoKey = yield* fromPromise(
    crypto.subtle.importKey(
      'spki',
      keyData,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    ),
    (cause) =>
      new VerificationKeyConfigurationError({
        message: 'Invalid SPKI verification key',
        cause,
      }),
  )

  return ok(cryptoKey)
})

/**
 * verify SendGrid webhook signature using ECDSA.
 * https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
const verifySignature = ResultFn(async function* (
  verificationKey: CryptoKey,
  payload: string,
  signature: string,
  timestamp: string,
) {
  // SendGrid signs: timestamp + payload
  const signedPayload = timestamp + payload

  // decode signature (base64)
  const signatureData = yield* fromSync(
    () => Uint8Array.from(atob(signature), (c) => c.charCodeAt(0)),
    () =>
      new SignatureVerificationError({ message: 'Invalid base64 signature' }),
  )

  // verify
  const encoder = new TextEncoder()
  const isValid = yield* fromPromise(
    crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verificationKey,
      signatureData,
      encoder.encode(signedPayload),
    ),
    () => new SignatureVerificationError({ message: 'Verification failed' }),
  )

  return ok(isValid)
})

export default createApp()
  .basePath('/sendgrid')
  .post('/events', async (c) => {
    const configuredVerificationKey =
      c.env.SENDGRID_WEBHOOK_VERIFICATION_KEY?.trim()

    if (!configuredVerificationKey) {
      logger.error('SendGrid webhook verification key is not configured')
      return c.json({ error: 'Internal server error' }, 500)
    }

    const verificationKeyResult = await importVerificationKey(
      configuredVerificationKey,
    )
    if (verificationKeyResult.isErr()) {
      logger.error('SendGrid webhook verification key is invalid', {
        reason: verificationKeyResult.error.message,
      })
      return c.json({ error: 'Internal server error' }, 500)
    }

    const signature = c.req.header('X-Twilio-Email-Event-Webhook-Signature')
    const timestamp = c.req.header('X-Twilio-Email-Event-Webhook-Timestamp')

    if (!signature || !timestamp) {
      return c.json({ error: 'Missing signature headers' }, 401)
    }

    const rawBody = await c.req.text()
    const verifyResult = await verifySignature(
      verificationKeyResult.value,
      rawBody,
      signature,
      timestamp,
    )

    if (verifyResult.isErr()) {
      logger.error('SendGrid signature verification failed', {
        reason: verifyResult.error.message,
      })
      return c.json({ error: 'Invalid signature' }, 401)
    }

    if (!verifyResult.value) {
      return c.json({ error: 'Invalid signature' }, 401)
    }

    const events = v.safeParse(SendGridWebhookRawBodySchema, rawBody)
    if (!events.success) {
      logger.warn('Invalid SendGrid webhook payload', {
        issues: events.issues,
      })
      return c.json({ error: 'Invalid payload' }, 400)
    }

    await processEvents(getDatabase(c.env), events.output)

    return c.json({ ok: true })
  })

async function processEvents(
  db: Database,
  events: v.InferOutput<typeof SendGridWebhookPayloadSchema>,
) {
  for (const event of events) {
    const channel = await db.query.userChannels.findFirst({
      where: eq(TABLE.userChannels.target, event.email),
    })

    if (!channel) {
      logger.warn('SendGrid event for unknown email', {
        email: event.email,
        event: event.event,
      })
      continue
    }

    switch (event.event) {
      case 'bounce':
      case 'dropped':
        // mark as bounced
        await db
          .update(TABLE.userChannels)
          .set({
            status: 'bounced',
            status_reason:
              event.reason ?? `${event.event}: ${event.type ?? 'unknown'}`,
            last_bounce_at: new Date(event.timestamp * 1000),
          })
          .where(eq(TABLE.userChannels.id, channel.id))

        logger.warn('Email channel marked as bounced', {
          channelId: channel.id,
          email: event.email,
          reason: event.reason,
        })
        break

      case 'spamreport':
        // mark as bounced (spam is a delivery failure)
        await db
          .update(TABLE.userChannels)
          .set({
            status: 'bounced',
            status_reason: 'User reported as spam',
            last_bounce_at: new Date(event.timestamp * 1000),
          })
          .where(eq(TABLE.userChannels.id, channel.id))

        logger.warn('Email channel marked as bounced (spam report)', {
          channelId: channel.id,
          email: event.email,
        })
        break

      case 'unsubscribe':
      case 'group_unsubscribe':
        // mark as unsubscribed
        await db
          .update(TABLE.userChannels)
          .set({
            status: 'unsubscribed',
            status_reason: 'User unsubscribed via email link',
          })
          .where(eq(TABLE.userChannels.id, channel.id))

        logger.info('Email channel marked as unsubscribed', {
          channelId: channel.id,
          email: event.email,
        })
        break
    }
  }
}
