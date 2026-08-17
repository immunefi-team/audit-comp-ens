import { TaggedError } from '@ens-apps/utils/neverthrow'
import { fromPromise, type ResultAsync } from 'neverthrow'

export const KV_KEY = {
  AUTH: {
    NONCE: (nonce: string) => `auth:nonce:${nonce}`,
  },
  EXPIRY_DISCOVERY: {
    CURSORS: 'expiry_discovery:cursors',
  },
  WALLET: {
    // Per-address lock serializing faucet funding so concurrent /wallet/fund
    // calls don't double-mint tokens (or race the funder's nonce).
    FUND_LOCK: (address: string) => `wallet:fund-lock:${address.toLowerCase()}`,
  },
  NOTIFICATIONS: {
    EMAIL_VERIFICATION: (normalizedEmail: string) =>
      `notifications:email-verification:${normalizedEmail}`,
  },
} as const

export const intoKVError = (err: unknown) => {
  const error =
    err instanceof Error
      ? err
      : new Error('Unknown KV error', {
          cause: err,
        })

  return new KVError({
    message: error.message,
    cause: error,
  })
}

class KVError extends TaggedError('KV_ERROR') {}

export const intoKVResult = <T>(
  promise: PromiseLike<T>,
): ResultAsync<T, KVError> => {
  return fromPromise(promise, intoKVError)
}
