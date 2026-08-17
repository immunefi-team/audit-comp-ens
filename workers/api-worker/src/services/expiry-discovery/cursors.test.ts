import { describe, expect, it } from 'vitest'
import { KV_KEY } from '#core/kv/index.js'
import { loadNotificationCursors, storeNotificationCursors } from './cursors.js'

class MockKV {
  private store = new Map<string, string>()

  async get(key: string, type?: 'json') {
    const raw = this.store.get(key)
    if (!raw) return null
    if (type === 'json') return JSON.parse(raw)
    return raw
  }

  async put(key: string, value: string) {
    this.store.set(key, value)
  }

  seed(key: string, value: unknown) {
    this.store.set(key, JSON.stringify(value))
  }

  readRaw(key: string) {
    return this.store.get(key)
  }
}

describe('notification cursors', () => {
  it('initializes defaults when KV value is missing', async () => {
    const env = { KV: new MockKV() } as unknown as CloudflareBindings
    const result = await loadNotificationCursors(env, 123)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      '30d': { expiry_timestamp: 123 },
      '7d': { expiry_timestamp: 123 },
      '1d': { expiry_timestamp: 123 },
      expired: { expiry_timestamp: 123 },
    })
  })

  it('fills missing stages from defaults when KV value is partial', async () => {
    const kv = new MockKV()
    kv.seed(KV_KEY.EXPIRY_DISCOVERY.CURSORS, {
      '30d': { expiry_timestamp: 10 },
      expired: { expiry_timestamp: 5 },
    })

    const env = { KV: kv } as unknown as CloudflareBindings
    const result = await loadNotificationCursors(env, 20)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      '30d': { expiry_timestamp: 10 },
      '7d': { expiry_timestamp: 20 },
      '1d': { expiry_timestamp: 20 },
      expired: { expiry_timestamp: 5 },
    })
  })

  it('returns CURSOR_PARSE_ERROR when KV value is invalid', async () => {
    const kv = new MockKV()
    kv.seed(KV_KEY.EXPIRY_DISCOVERY.CURSORS, {
      '30d': { expiry_timestamp: 'oops' },
    })

    const env = { KV: kv } as unknown as CloudflareBindings
    const result = await loadNotificationCursors(env, 10)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()._tag).toBe('CURSOR_PARSE_ERROR')
  })

  it('stores all stage cursors in one KV key', async () => {
    const kv = new MockKV()
    const env = { KV: kv } as unknown as CloudflareBindings

    const writeResult = await storeNotificationCursors(env, {
      '30d': { expiry_timestamp: 1 },
      '7d': { expiry_timestamp: 2 },
      '1d': { expiry_timestamp: 3 },
      expired: { expiry_timestamp: 4 },
    })

    expect(writeResult.isOk()).toBe(true)

    const stored = kv.readRaw(KV_KEY.EXPIRY_DISCOVERY.CURSORS)
    expect(stored).toBeTruthy()
    // biome-ignore lint/style/noNonNullAssertion: test assertion - stored verified truthy above
    expect(JSON.parse(stored!)).toEqual({
      '30d': { expiry_timestamp: 1 },
      '7d': { expiry_timestamp: 2 },
      '1d': { expiry_timestamp: 3 },
      expired: { expiry_timestamp: 4 },
    })
  })
})
