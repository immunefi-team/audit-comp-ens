import type {
  ChannelData,
  ChannelType as UserChannel,
} from '@ens-apps/shared-schema/notifications'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { fromPromise, ok } from 'neverthrow'
import type { TABLE } from '#core/database/index.js'
import { logger } from '#utils/logger.js'

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

export class HashPushEndpointError extends TaggedError(
  'HashPushEndpointError',
)<{
  cause: unknown
}> {}

export const hashPushEndpoint = (endpoint: string) =>
  fromPromise(
    (async () => {
      const bytes = new TextEncoder().encode(endpoint)
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      return bytesToHex(new Uint8Array(digest))
    })(),
    (cause) => new HashPushEndpointError({ cause }),
  )

export const sanitizeChannel = <T extends UserChannel>(
  channel: T,
  target: string | null,
  data: ChannelData[T],
) => {
  switch (channel) {
    case 'email': {
      if (!target) {
        logger.warn('Email target is undefined', {
          hasData: Boolean(data),
        })
        return 'Unknown Email'
      }
      return target
    }
    case 'telegram':
      return `@${(data as ChannelData['telegram']).username}`
    case 'push':
      return 'Push Notification'
    default:
      return String(target ?? 'Unknown')
  }
}

export type QueryChannelRow = Pick<
  typeof TABLE.userChannels.$inferSelect,
  | 'id'
  | 'channel'
  | 'target'
  | 'data'
  | 'status'
  | 'status_reason'
  | 'verified_at'
  | 'last_sent_at'
  | 'last_bounce_at'
  | 'last_verification_sent_at'
>

type PublicChannelBase = Omit<QueryChannelRow, 'target' | 'data'> & {
  label: string
}

type PublicEmailChannel = PublicChannelBase & {
  channel: 'email'
}

type PublicTelegramChannel = PublicChannelBase & {
  channel: 'telegram'
}

type PublicPushChannel = PublicChannelBase & {
  channel: 'push'
  endpointHash: string
}

export type PublicChannel =
  | PublicEmailChannel
  | PublicTelegramChannel
  | PublicPushChannel

class PublicChannelMappingError extends TaggedError(
  'PublicChannelMappingError',
)<{
  cause: unknown
}> {}

export const toPublicChannel = ResultFn(async function* (
  channel: QueryChannelRow,
) {
  switch (channel.channel) {
    case 'email': {
      return ok({
        id: channel.id,
        channel: 'email',
        status: channel.status,
        status_reason: channel.status_reason,
        verified_at: channel.verified_at,
        last_sent_at: channel.last_sent_at,
        last_bounce_at: channel.last_bounce_at,
        last_verification_sent_at: channel.last_verification_sent_at,
        label: sanitizeChannel(
          'email',
          channel.target,
          channel.data as ChannelData['email'],
        ),
      } satisfies PublicEmailChannel)
    }
    case 'telegram': {
      return ok({
        id: channel.id,
        channel: 'telegram',
        status: channel.status,
        status_reason: channel.status_reason,
        verified_at: channel.verified_at,
        last_sent_at: channel.last_sent_at,
        last_bounce_at: channel.last_bounce_at,
        last_verification_sent_at: channel.last_verification_sent_at,
        label: sanitizeChannel(
          'telegram',
          channel.target,
          channel.data as ChannelData['telegram'],
        ),
      } satisfies PublicTelegramChannel)
    }
    case 'push': {
      const target = channel.target
      if (target === null) {
        return yield* new PublicChannelMappingError({
          cause: new Error('Missing push target for push channel'),
        })
      }

      const endpointHash = yield* hashPushEndpoint(target).mapErr(
        (error) =>
          new PublicChannelMappingError({
            cause: error,
          }),
      )

      return ok({
        id: channel.id,
        channel: 'push',
        status: channel.status,
        status_reason: channel.status_reason,
        verified_at: channel.verified_at,
        last_sent_at: channel.last_sent_at,
        last_bounce_at: channel.last_bounce_at,
        last_verification_sent_at: channel.last_verification_sent_at,
        label: sanitizeChannel(
          'push',
          target,
          channel.data as ChannelData['push'],
        ),
        endpointHash,
      } satisfies PublicPushChannel)
    }
    default: {
      return yield* new PublicChannelMappingError({
        cause: new Error(`Unknown channel type: ${channel.channel}`),
      })
    }
  }
})

export const generateToken = () => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}
