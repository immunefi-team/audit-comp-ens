import { fromPromise } from 'neverthrow'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMockDb } from '#test-utils/db.js'
import { makeMockEnv } from '#test-utils/env.js'
import { makeQueueBatch, makeQueueMessage } from '#test-utils/queue.js'
import type { ExpiryEvent } from '#types/events/index.js'

vi.mock('#core/database/index.js', async () => {
  const actual = await vi.importActual<
    typeof import('#core/database/index.js')
  >('#core/database/index.js')

  return {
    ...actual,
    getDatabase: vi.fn(),
    intoDbResult: <T>(promise: PromiseLike<T>) =>
      fromPromise(Promise.resolve(promise), (error) => error as Error),
  }
})

import { getDatabase } from '#core/database/index.js'
import {
  buildIdempotencyKey,
  collectRecipientsForEvent,
  handleEventIngestionQueue,
  shouldCreateExternalDeliveries,
} from './event-ingestion.js'

const mockGetDatabase = vi.mocked(getDatabase)

describe('event-ingestion helpers', () => {
  it('builds deterministic idempotency keys', () => {
    const event: ExpiryEvent = {
      type: 'name_expiring',
      name: 'alpha.eth',
      expiryDate: 1_700_000_000,
      stage: '7d',
      owner: '0xabc',
      includeFavorites: true,
    }

    expect(buildIdempotencyKey(event, 'user-1')).toBe(
      'name-expiry:user-1:alpha.eth:7d:1700000000',
    )
  })

  it('collects owner and favourites with owner priority', () => {
    const recipients = collectRecipientsForEvent(
      {
        type: 'name_expiring',
        name: 'alpha.eth',
        expiryDate: 1,
        stage: '1d',
        owner: '0xabc',
        includeFavorites: true,
      },
      new Map([['0xabc', 'user-owner']]),
      new Map([['alpha.eth', new Set(['user-owner', 'user-fav'])]]),
    )

    expect(recipients.get('user-owner')).toBe('owned')
    expect(recipients.get('user-fav')).toBe('favourited')
  })

  it('evaluates delivery settings by watch reason', () => {
    expect(
      shouldCreateExternalDeliveries('owned', {
        owned_name_expiry: true,
        favourited_name_expiry: false,
      }),
    ).toBe(true)

    expect(
      shouldCreateExternalDeliveries('favourited', {
        owned_name_expiry: true,
        favourited_name_expiry: false,
      }),
    ).toBe(false)
  })
})

describe('handleEventIngestionQueue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('acks unsupported event types', async () => {
    const message = makeQueueMessage({ type: 'name_registered' })
    const batch = makeQueueBatch('app-api-worker-event-ingestion', [message])

    const dbFixture = makeMockDb()
    mockGetDatabase.mockReturnValue(dbFixture.db as never)

    await handleEventIngestionQueue(batch, makeMockEnv())

    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()
  })

  it('acks invalid payloads', async () => {
    const message = makeQueueMessage({
      type: 'name_expiring',
      name: 'missing-fields',
    })
    const batch = makeQueueBatch('app-api-worker-event-ingestion', [message])

    const dbFixture = makeMockDb()
    mockGetDatabase.mockReturnValue(dbFixture.db as never)

    await handleEventIngestionQueue(batch, makeMockEnv())

    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()
  })

  it('dedupes owner+favorite users and inserts one notification', async () => {
    const eventMessage = makeQueueMessage<ExpiryEvent>({
      type: 'name_expiring',
      name: 'alpha.eth',
      expiryDate: 1_700_000_000,
      stage: '7d',
      owner: '0xabc',
      includeFavorites: true,
    })

    const batch = makeQueueBatch('app-api-worker-event-ingestion', [
      eventMessage,
    ])

    const dbFixture = makeMockDb({
      users: [{ id: 'user-1', address: '0xabc' }],
      favorites: [{ user_id: 'user-1', name: 'alpha.eth' }],
      insertedNotifications: [
        {
          id: 'notif-1',
          user_id: 'user-1',
          kind: 'name-expiry',
          payload: {
            name: 'alpha.eth',
            expiryDate: 1_700_000_000_000,
            isOwner: true,
            watchReason: 'owned',
          },
        },
      ],
      userChannels: [
        { user_id: 'user-1', channel: 'email', target: 'user@example.com' },
      ],
      userSettings: [
        {
          user_id: 'user-1',
          owned_name_expiry: true,
          favourited_name_expiry: true,
        },
      ],
    })

    mockGetDatabase.mockReturnValue(dbFixture.db as never)

    const emailQueue = {
      send: vi.fn(async () => undefined),
      sendBatch: vi.fn(
        async (_messages: Array<{ body: unknown }>) => undefined,
      ),
    }
    const env = makeMockEnv({ EMAIL_QUEUE: emailQueue as unknown as Queue })

    await handleEventIngestionQueue(batch, env)

    expect(dbFixture.notificationsInsertValues).toHaveLength(1)
    expect(dbFixture.deliveriesInsertValues).toHaveLength(1)
    expect(emailQueue.sendBatch).toHaveBeenCalledTimes(1)
    expect(eventMessage.ack).toHaveBeenCalledTimes(1)
    expect(eventMessage.retry).not.toHaveBeenCalled()
  })

  it('respects preference gating and skips delivery fanout when disabled', async () => {
    const eventMessage = makeQueueMessage<ExpiryEvent>({
      type: 'name_expiring',
      name: 'alpha.eth',
      expiryDate: 1_700_000_000,
      stage: '7d',
      owner: '0xabc',
      includeFavorites: true,
    })

    const batch = makeQueueBatch('app-api-worker-event-ingestion', [
      eventMessage,
    ])

    const dbFixture = makeMockDb({
      users: [{ id: 'user-1', address: '0xabc' }],
      favorites: [],
      insertedNotifications: [
        {
          id: 'notif-1',
          user_id: 'user-1',
          kind: 'name-expiry',
          payload: {
            name: 'alpha.eth',
            expiryDate: 1_700_000_000_000,
            isOwner: true,
            watchReason: 'owned',
          },
        },
      ],
      userChannels: [
        { user_id: 'user-1', channel: 'email', target: 'user@example.com' },
      ],
      userSettings: [
        {
          user_id: 'user-1',
          owned_name_expiry: false,
          favourited_name_expiry: true,
        },
      ],
    })

    mockGetDatabase.mockReturnValue(dbFixture.db as never)

    const emailQueue = {
      send: vi.fn(async () => undefined),
      sendBatch: vi.fn(
        async (_messages: Array<{ body: unknown }>) => undefined,
      ),
    }
    const env = makeMockEnv({ EMAIL_QUEUE: emailQueue as unknown as Queue })

    await handleEventIngestionQueue(batch, env)

    expect(dbFixture.deliveriesInsertValues).toHaveLength(0)
    expect(emailQueue.sendBatch).not.toHaveBeenCalled()
    expect(eventMessage.ack).toHaveBeenCalledTimes(1)
  })

  it('supports conflict-do-nothing no-op when insert returns empty', async () => {
    const eventMessage = makeQueueMessage<ExpiryEvent>({
      type: 'name_expiring',
      name: 'alpha.eth',
      expiryDate: 1_700_000_000,
      stage: '7d',
      owner: '0xabc',
      includeFavorites: true,
    })

    const batch = makeQueueBatch('app-api-worker-event-ingestion', [
      eventMessage,
    ])

    const dbFixture = makeMockDb({
      users: [{ id: 'user-1', address: '0xabc' }],
      favorites: [],
      insertedNotifications: [],
      userChannels: [],
      userSettings: [],
    })

    mockGetDatabase.mockReturnValue(dbFixture.db as never)

    await handleEventIngestionQueue(batch, makeMockEnv())

    expect(dbFixture.notificationsInsertValues).toHaveLength(1)
    expect(dbFixture.deliveriesInsertValues).toHaveLength(0)
    expect(eventMessage.ack).toHaveBeenCalledTimes(1)
  })

  it('chunks queue fanout at <=95 jobs', async () => {
    const message = makeQueueMessage<ExpiryEvent>({
      type: 'name_expiring',
      name: 'alpha.eth',
      expiryDate: 1_700_000_000,
      stage: '7d',
      owner: undefined,
      includeFavorites: true,
    })

    const batch = makeQueueBatch('app-api-worker-event-ingestion', [message])

    const favorites = Array.from({ length: 120 }, (_, i) => ({
      user_id: `user-${i}`,
      name: 'alpha.eth',
    }))

    const insertedNotifications = Array.from({ length: 120 }, (_, i) => ({
      id: `notif-${i}`,
      user_id: `user-${i}`,
      kind: 'name-expiry' as const,
      payload: {
        name: 'alpha.eth',
        expiryDate: 1_700_000_000_000,
        isOwner: false,
        watchReason: 'favourited',
      },
    }))

    const userChannels = Array.from({ length: 120 }, (_, i) => ({
      user_id: `user-${i}`,
      channel: 'email',
      target: `user-${i}@example.com`,
    }))

    const userSettings = Array.from({ length: 120 }, (_, i) => ({
      user_id: `user-${i}`,
      owned_name_expiry: true,
      favourited_name_expiry: true,
    }))

    const dbFixture = makeMockDb({
      users: [],
      favorites,
      insertedNotifications,
      userChannels,
      userSettings,
    })

    mockGetDatabase.mockReturnValue(dbFixture.db as never)

    const emailQueue = {
      send: vi.fn(async () => undefined),
      sendBatch: vi.fn(
        async (_messages: Array<{ body: unknown }>) => undefined,
      ),
    }
    const env = makeMockEnv({ EMAIL_QUEUE: emailQueue as unknown as Queue })

    await handleEventIngestionQueue(batch, env)

    expect(emailQueue.sendBatch).toHaveBeenCalledTimes(2)
    const firstChunk = emailQueue.sendBatch.mock.calls[0]?.[0]
    const secondChunk = emailQueue.sendBatch.mock.calls[1]?.[0]
    expect(firstChunk).toBeDefined()
    expect(secondChunk).toBeDefined()
    expect((firstChunk as Array<unknown>).length).toBe(95)
    expect((secondChunk as Array<unknown>).length).toBe(25)
  })

  it('continues fanout when one channel queue fails after retries', async () => {
    const message = makeQueueMessage<ExpiryEvent>({
      type: 'name_expiring',
      name: 'alpha.eth',
      expiryDate: 1_700_000_000,
      stage: '7d',
      owner: '0xabc',
      includeFavorites: true,
    })
    const batch = makeQueueBatch('app-api-worker-event-ingestion', [message])

    const dbFixture = makeMockDb({
      users: [{ id: 'user-1', address: '0xabc' }],
      favorites: [],
      insertedNotifications: [
        {
          id: 'notif-1',
          user_id: 'user-1',
          kind: 'name-expiry',
          payload: {
            name: 'alpha.eth',
            expiryDate: 1_700_000_000_000,
            isOwner: true,
            watchReason: 'owned',
          },
        },
      ],
      userChannels: [
        { user_id: 'user-1', channel: 'email', target: 'user@example.com' },
        { user_id: 'user-1', channel: 'telegram', target: '123456' },
      ],
      userSettings: [
        {
          user_id: 'user-1',
          owned_name_expiry: true,
          favourited_name_expiry: true,
        },
      ],
    })
    mockGetDatabase.mockReturnValue(dbFixture.db as never)

    const emailQueue = {
      send: vi.fn(async () => undefined),
      sendBatch: vi.fn(
        async (_messages: Array<{ body: unknown }>) => undefined,
      ),
    }
    const telegramQueue = {
      send: vi.fn(async () => undefined),
      sendBatch: vi.fn(async () => {
        throw new Error('rate limited')
      }),
    }

    const env = makeMockEnv({
      EMAIL_QUEUE: emailQueue as unknown as Queue,
      TELEGRAM_QUEUE: telegramQueue as unknown as Queue,
    })

    await handleEventIngestionQueue(batch, env)

    expect(dbFixture.deliveriesInsertValues).toHaveLength(2)
    expect(emailQueue.sendBatch).toHaveBeenCalledTimes(1)
    expect(telegramQueue.sendBatch).toHaveBeenCalledTimes(3)
    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()
  })

  it('retries transient queue failures and still acks batch', async () => {
    const message = makeQueueMessage<ExpiryEvent>({
      type: 'name_expiring',
      name: 'alpha.eth',
      expiryDate: 1_700_000_000,
      stage: '7d',
      owner: '0xabc',
      includeFavorites: true,
    })
    const batch = makeQueueBatch('app-api-worker-event-ingestion', [message])

    const dbFixture = makeMockDb({
      users: [{ id: 'user-1', address: '0xabc' }],
      favorites: [],
      insertedNotifications: [
        {
          id: 'notif-1',
          user_id: 'user-1',
          kind: 'name-expiry',
          payload: {
            name: 'alpha.eth',
            expiryDate: 1_700_000_000_000,
            isOwner: true,
            watchReason: 'owned',
          },
        },
      ],
      userChannels: [
        { user_id: 'user-1', channel: 'email', target: 'user@example.com' },
      ],
      userSettings: [
        {
          user_id: 'user-1',
          owned_name_expiry: true,
          favourited_name_expiry: true,
        },
      ],
    })
    mockGetDatabase.mockReturnValue(dbFixture.db as never)

    const emailQueue = {
      send: vi.fn(async () => undefined),
      sendBatch: vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary'))
        .mockResolvedValue(undefined),
    }
    const env = makeMockEnv({
      EMAIL_QUEUE: emailQueue as unknown as Queue,
    })

    await handleEventIngestionQueue(batch, env)

    expect(emailQueue.sendBatch).toHaveBeenCalledTimes(2)
    expect(message.ack).toHaveBeenCalledTimes(1)
    expect(message.retry).not.toHaveBeenCalled()
  })

  it('retries valid messages when processing fails', async () => {
    const message = makeQueueMessage<ExpiryEvent>({
      type: 'name_expiring',
      name: 'alpha.eth',
      expiryDate: 1_700_000_000,
      stage: '7d',
      owner: '0xabc',
      includeFavorites: true,
    })
    const batch = makeQueueBatch('app-api-worker-event-ingestion', [message])

    const dbFixture = makeMockDb()
    dbFixture.db.query.users.findMany.mockRejectedValue(new Error('db down'))
    mockGetDatabase.mockReturnValue(dbFixture.db as never)

    await handleEventIngestionQueue(batch, makeMockEnv())

    expect(message.retry).toHaveBeenCalledTimes(1)
    expect(message.ack).not.toHaveBeenCalled()
  })
})
