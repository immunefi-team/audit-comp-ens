import { errAsync, okAsync } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./indexer.js', () => ({
  fetchExpiringNamesPage: vi.fn(),
}))

import { KV_KEY } from '#core/kv/index.js'
import { runExpiryDiscoveryCron } from './index.js'
import { fetchExpiringNamesPage } from './indexer.js'
import { STAGES } from './stages.js'

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
}

type CursorState = Record<string, { expiry_timestamp: number }>

describe('runExpiryDiscoveryCron', () => {
  beforeEach(() => {
    vi.mocked(fetchExpiringNamesPage).mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-11T12:00:00Z'))
  })

  it('enqueues events and persists stage cursors', async () => {
    const sendBatch = vi.fn(
      async (_messages: Array<{ body: unknown }>) => undefined,
    )
    vi.mocked(fetchExpiringNamesPage).mockImplementation(
      ({ stage, cursor }) => {
        if (stage.id === '30d') {
          return okAsync({
            domains: [
              { name: 'alpha.eth', expiryDate: cursor + 100, owner: '0xabc' },
            ],
            hasMore: false,
          })
        }

        return okAsync({ domains: [], hasMore: false })
      },
    )

    const env = {
      KV: new MockKV(),
      EVENT_INGESTION_QUEUE: { sendBatch },
    } as unknown as CloudflareBindings

    const result = await runExpiryDiscoveryCron(env)

    expect(result.isOk()).toBe(true)
    expect(sendBatch).toHaveBeenCalledTimes(1)

    const firstBatch = sendBatch.mock.calls[0]?.[0] as
      | Array<{
          body: { includeFavorites: boolean; stage: string; type: string }
        }>
      | undefined
    expect(firstBatch).toBeDefined()
    expect(firstBatch?.[0].body.type).toBe('name_expiring')
    expect(firstBatch?.[0].body.includeFavorites).toBe(false)
    expect(firstBatch?.[0].body.stage).toBe('30d')

    const cursors = (await env.KV.get(
      KV_KEY.EXPIRY_DISCOVERY.CURSORS,
      'json',
    )) as CursorState
    expect(cursors['30d'].expiry_timestamp).toBeGreaterThan(
      cursors['7d'].expiry_timestamp,
    )
  })

  it('keeps cursor unchanged for empty stage pages', async () => {
    vi.mocked(fetchExpiringNamesPage).mockReturnValue(
      okAsync({ domains: [], hasMore: false }),
    )

    const kv = new MockKV()
    kv.seed(KV_KEY.EXPIRY_DISCOVERY.CURSORS, {
      '30d': { expiry_timestamp: 111 },
      '7d': { expiry_timestamp: 222 },
      '1d': { expiry_timestamp: 333 },
      expired: { expiry_timestamp: 444 },
    })

    const env = {
      KV: kv,
      EVENT_INGESTION_QUEUE: { sendBatch: vi.fn(async () => undefined) },
    } as unknown as CloudflareBindings

    const result = await runExpiryDiscoveryCron(env)

    expect(result.isOk()).toBe(true)
    const cursors = (await kv.get(
      KV_KEY.EXPIRY_DISCOVERY.CURSORS,
      'json',
    )) as CursorState
    expect(cursors).toEqual({
      '30d': { expiry_timestamp: 111 },
      '7d': { expiry_timestamp: 222 },
      '1d': { expiry_timestamp: 333 },
      expired: { expiry_timestamp: 444 },
    })
  })

  it('skips indexer calls when cursor is already caught up', async () => {
    const nowSec = Math.floor(new Date('2026-02-11T12:00:00Z').getTime() / 1000)

    const kv = new MockKV()
    kv.seed(KV_KEY.EXPIRY_DISCOVERY.CURSORS, {
      '30d': { expiry_timestamp: nowSec + 31 * 86_400 },
      '7d': { expiry_timestamp: nowSec + 8 * 86_400 },
      '1d': { expiry_timestamp: nowSec + 2 * 86_400 },
      expired: { expiry_timestamp: nowSec },
    })

    const env = {
      KV: kv,
      EVENT_INGESTION_QUEUE: { sendBatch: vi.fn(async () => undefined) },
    } as unknown as CloudflareBindings

    const result = await runExpiryDiscoveryCron(env)

    expect(result.isOk()).toBe(true)
    expect(fetchExpiringNamesPage).not.toHaveBeenCalled()
  })

  it('commits successful stages when one stage fails', async () => {
    const sendBatch = vi.fn(
      async (_messages: Array<{ body: unknown }>) => undefined,
    )

    vi.mocked(fetchExpiringNamesPage).mockImplementation(
      ({ stage, cursor }) => {
        if (stage.id === '7d') {
          return errAsync(new Error('indexer failed') as never)
        }

        if (stage.id === '1d') {
          return okAsync({
            domains: [
              { name: 'beta.eth', expiryDate: cursor + 50, owner: '0xdef' },
            ],
            hasMore: false,
          })
        }

        return okAsync({ domains: [], hasMore: false })
      },
    )

    const env = {
      KV: new MockKV(),
      EVENT_INGESTION_QUEUE: { sendBatch },
    } as unknown as CloudflareBindings

    const result = await runExpiryDiscoveryCron(env)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().failedStages).toBe(1)

    const cursors = (await env.KV.get(
      KV_KEY.EXPIRY_DISCOVERY.CURSORS,
      'json',
    )) as CursorState
    const nowSec = Math.floor(new Date('2026-02-11T12:00:00Z').getTime() / 1000)

    expect(cursors['1d'].expiry_timestamp).toBe(nowSec + 50)
    expect(cursors['7d'].expiry_timestamp).toBe(nowSec)
  })

  it('chunks queue batches at 100 messages', async () => {
    const sendBatch = vi.fn(
      async (_messages: Array<{ body: unknown }>) => undefined,
    )

    vi.mocked(fetchExpiringNamesPage).mockImplementation(
      ({ stage, cursor }) => {
        if (stage.id !== '30d') {
          return okAsync({ domains: [], hasMore: false })
        }

        return okAsync({
          domains: Array.from({ length: 201 }, (_, i) => ({
            name: `name-${i}.eth`,
            expiryDate: cursor + i + 1,
            owner: '0xabc',
          })),
          hasMore: false,
        })
      },
    )

    const env = {
      KV: new MockKV(),
      EVENT_INGESTION_QUEUE: { sendBatch },
    } as unknown as CloudflareBindings

    const result = await runExpiryDiscoveryCron(env)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().totalEnqueued).toBe(201)
    expect(sendBatch).toHaveBeenCalledTimes(3)
    expect((sendBatch.mock.calls[0]?.[0] as Array<unknown>).length).toBe(100)
    expect((sendBatch.mock.calls[1]?.[0] as Array<unknown>).length).toBe(100)
    expect((sendBatch.mock.calls[2]?.[0] as Array<unknown>).length).toBe(1)
  })

  it('calls indexer for stages that are not already caught up', async () => {
    vi.mocked(fetchExpiringNamesPage).mockReturnValue(
      okAsync({ domains: [], hasMore: false }),
    )

    const env = {
      KV: new MockKV(),
      EVENT_INGESTION_QUEUE: { sendBatch: vi.fn(async () => undefined) },
    } as unknown as CloudflareBindings

    const result = await runExpiryDiscoveryCron(env)

    expect(result.isOk()).toBe(true)
    // `expired` starts at now on first run, so it is immediately caught up.
    expect(fetchExpiringNamesPage).toHaveBeenCalledTimes(STAGES.length - 1)
  })
})
