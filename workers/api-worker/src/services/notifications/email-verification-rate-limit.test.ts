import { describe, expect, it } from 'vitest'
import { KV_KEY } from '#core/kv/index.js'
import {
  checkAndConsumeEmailVerificationRateLimit,
  EMAIL_VERIFICATION_RATE_LIMIT_MAX_SENDS,
  EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_SECONDS,
  formatEmailVerificationRateLimitError,
  normalizeEmailForRateLimit,
} from './email-verification-rate-limit.js'

class MockKV {
  private store = new Map<string, string>()

  async get(key: string) {
    return this.store.get(key) ?? null
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    void options
    this.store.set(key, value)
  }
}

describe('normalizeEmailForRateLimit', () => {
  it('trims and lowercases email', () => {
    expect(normalizeEmailForRateLimit('  User@Example.COM ')).toBe(
      'user@example.com',
    )
  })
})

describe('formatEmailVerificationRateLimitError', () => {
  it('returns a user-facing message with at least one minute', () => {
    expect(formatEmailVerificationRateLimitError(30)).toContain('1 minute')
    expect(formatEmailVerificationRateLimitError(120)).toContain('2 minutes')
  })
})

const asKv = (mock: MockKV) => mock as unknown as KVNamespace

describe('checkAndConsumeEmailVerificationRateLimit', () => {
  it('allows up to max sends per hour for the same normalized address', async () => {
    const kv = asKv(new MockKV())
    const email = 'spam@example.com'

    for (let i = 0; i < EMAIL_VERIFICATION_RATE_LIMIT_MAX_SENDS; i++) {
      const result = await checkAndConsumeEmailVerificationRateLimit(kv, email)
      expect(result).toEqual({ isAllowed: true })
    }

    const blocked = await checkAndConsumeEmailVerificationRateLimit(kv, email)
    expect(blocked.isAllowed).toBe(false)
    if (!blocked.isAllowed) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(
        EMAIL_VERIFICATION_RATE_LIMIT_WINDOW_SECONDS,
      )
    }
  })

  it('shares the limit across differently cased addresses', async () => {
    const kv = asKv(new MockKV())

    for (let i = 0; i < EMAIL_VERIFICATION_RATE_LIMIT_MAX_SENDS; i++) {
      await checkAndConsumeEmailVerificationRateLimit(kv, 'a@b.com')
    }

    const blocked = await checkAndConsumeEmailVerificationRateLimit(
      kv,
      '  A@B.COM ',
    )
    expect(blocked.isAllowed).toBe(false)
  })

  it('stores state under the notifications KV key', async () => {
    const mock = new MockKV()
    const kv = asKv(mock)
    await checkAndConsumeEmailVerificationRateLimit(kv, 'x@y.z')

    const key = KV_KEY.NOTIFICATIONS.EMAIL_VERIFICATION('x@y.z')
    const raw = await mock.get(key)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toMatchObject({ count: 1 })
  })
})
