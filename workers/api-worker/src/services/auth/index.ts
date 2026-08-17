import { TaggedError } from '@ens-apps/utils/neverthrow'
import { ok, safeTry } from 'neverthrow'
import type { Address, Hash } from 'viem'
import { generateSiweNonce } from 'viem/siwe'
import { signJWT } from '#core/auth/jwt.js'
import type { Database } from '#core/database/index.js'
import type { ViemClient } from '#core/eth/client.js'
import { intoKVResult, KV_KEY } from '#core/kv/index.js'
import { logger } from '#utils/logger.js'
import { addUserIfNotExists } from '../users'
import { safeParseSiweMessage, safeVerifySiweMessage } from './helpers'

const ALLOWED_SIWE_DOMAINS = ['app.ens.dev', 'app.ens.domains'] as const
type AllowedSiweDomain = (typeof ALLOWED_SIWE_DOMAINS)[number]

class InvalidNonceError extends TaggedError('INVALID_NONCE')<{
  message: string
}> {}

class InvalidSignatureError extends TaggedError('INVALID_SIGNATURE')<{
  message: string
}> {}

class InvalidDomainError extends TaggedError('INVALID_DOMAIN')<{
  message: string
}> {}

class InvalidUriError extends TaggedError('INVALID_URI')<{
  message: string
}> {}

export const createNonce = (env: CloudflareBindings) => {
  const nonce = generateSiweNonce()

  return intoKVResult(
    env.KV.put(KV_KEY.AUTH.NONCE(nonce), nonce, {
      expirationTtl: 60 * 30, // 30 minutes
    }),
  ).map((_) => nonce)
}

export const verifyAndConsumeNonce = (env: CloudflareBindings, nonce: string) =>
  safeTry(async function* () {
    const value = yield* intoKVResult(env.KV.get(KV_KEY.AUTH.NONCE(nonce)))

    if (!value) {
      yield* new InvalidNonceError({
        message: 'Invalid nonce',
      })
    }

    yield* intoKVResult(env.KV.delete(KV_KEY.AUTH.NONCE(nonce)))

    return ok(value)
  })

export const createJWT = ({
  env,
  client,
  db,
  address,
  message,
  signature,
  nonce,
}: {
  env: CloudflareBindings
  client: ViemClient
  db: Database
  address: Address
  message: string
  signature: Hash
  nonce: string
}) =>
  safeTry(async function* () {
    yield* verifyAndConsumeNonce(env, nonce)

    const parsed = yield* safeParseSiweMessage(message)

    if (
      !parsed.domain ||
      !ALLOWED_SIWE_DOMAINS.includes(parsed.domain as AllowedSiweDomain)
    ) {
      yield* new InvalidDomainError({
        message: 'Invalid SIWE domain',
      })
    }

    const expectedUri = `https://${parsed.domain}`
    if (parsed.uri !== expectedUri) {
      yield* new InvalidUriError({
        message: 'Invalid SIWE uri',
      })
    }

    const valid = yield* safeVerifySiweMessage(client, {
      address,
      message,
      signature,
      nonce,
      domain: parsed.domain,
    })

    if (!valid) {
      yield* new InvalidSignatureError({
        message: 'Unable to verify signature',
      })
    }

    const user = yield* addUserIfNotExists(db, address)
    logger.trace('SIWE user resolved', {
      userId: user.id,
      address,
    })

    const jwt = yield* signJWT(
      {
        address,
        user_id: user.id,
      },
      env,
    )

    return ok(jwt)
  })
