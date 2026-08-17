import { vi } from 'vitest'

export function makeMockQueue<T = unknown>() {
  return {
    send: vi.fn(async (_message: T) => undefined),
    sendBatch: vi.fn(async (_messages: Array<{ body: T }>) => undefined),
  }
}

export function makeMockEnv(
  overrides?: Partial<CloudflareBindings>,
): CloudflareBindings {
  const eventIngestionQueue = makeMockQueue()
  const telegramQueue = makeMockQueue()
  const emailQueue = makeMockQueue()
  const pushQueue = makeMockQueue()

  return {
    KV: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => undefined),
    } as unknown as KVNamespace,
    EVENT_INGESTION_QUEUE: eventIngestionQueue as unknown as Queue,
    TELEGRAM_QUEUE: telegramQueue as unknown as Queue,
    EMAIL_QUEUE: emailQueue as unknown as Queue,
    PUSH_QUEUE: pushQueue as unknown as Queue,
    ENS_INDEXER_GRAPHQL_URL: 'https://graphql.ens.dev/',
    ...overrides,
  } as unknown as CloudflareBindings
}
