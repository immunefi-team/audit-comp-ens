import type { TelegramAuthData } from '@ens-apps/shared-schema/telegram'
import { ResultFn } from '@ens-apps/utils/neverthrow'
import { fromPromise, ok } from 'neverthrow'
import { createIntoError, error } from '#utils/result.js'

const hmacSha256 = async (
  key: ArrayBuffer,
  data: Uint8Array<ArrayBufferLike>,
) => {
  // Import the secret as a CryptoKey for HMAC
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  // biome-ignore lint/suspicious/noTsIgnore: TODO: Fix TS issues
  // @ts-ignore
  return crypto.subtle.sign('HMAC', cryptoKey, data)
}

const createDataCheckString = (data: Record<string, string | number>) => {
  return Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n')
}

const computeAuthDataHash = async (
  data: Omit<TelegramAuthData, 'hash'>,
  botToken: string,
) => {
  const checkString = createDataCheckString(data)

  const encodedBotToken = new TextEncoder().encode(botToken)
  const hashedBotToken = await crypto.subtle.digest('SHA-256', encodedBotToken)

  const encodedCheckString = new TextEncoder().encode(checkString)
  const signature = await hmacSha256(hashedBotToken, encodedCheckString)

  const computed = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  return computed
}

export const verifyTelegramAuth = ResultFn(async function* (
  botToken: string,
  data: TelegramAuthData,
  /**
   * Max age of the auth data in milliseconds
   * @default 1 day
   */
  maxAge: number = 3_600_000, // 1 hour
) {
  const { hash, ...rest } = data

  const computedHash = yield* fromPromise(
    computeAuthDataHash(rest, botToken),
    createIntoError('TELEGRAM_COMPUTE_HASH_ERROR'),
  )

  if (Date.now() - data.auth_date * 1000 > maxAge) {
    return error({
      code: 'TELEGRAM_AUTH_DATA_EXPIRED',
      message: 'Auth data expired',
    })
  }

  if (computedHash !== hash) {
    return error({
      code: 'TELEGRAM_AUTH_DATA_HASH_MISMATCH',
      message: 'Auth data hash mismatch',
    })
  }

  return ok()
})
