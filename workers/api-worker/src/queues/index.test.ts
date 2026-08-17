import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./telegram.js', () => ({
  handleTelegramQueue: vi.fn(async () => undefined),
}))
vi.mock('./email.js', () => ({
  handleEmailQueue: vi.fn(async () => undefined),
}))
vi.mock('./push.js', () => ({
  handlePushQueue: vi.fn(async () => undefined),
}))
vi.mock('./event-ingestion.js', () => ({
  handleEventIngestionQueue: vi.fn(async () => undefined),
}))

import { logger } from '#utils/logger.js'
import { handleEmailQueue } from './email.js'
import { handleEventIngestionQueue } from './event-ingestion.js'
import { handleQueue } from './index.js'
import { handlePushQueue } from './push.js'
import { handleTelegramQueue } from './telegram.js'

const env = {} as CloudflareBindings

function batch(queue: string): MessageBatch {
  return {
    queue,
    messages: [],
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  } as unknown as MessageBatch
}

describe('handleQueue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('routes event-ingestion queue', async () => {
    await handleQueue(batch('app-api-worker-event-ingestion'), env)
    expect(handleEventIngestionQueue).toHaveBeenCalledTimes(1)
  })

  it('routes existing delivery queues', async () => {
    await handleQueue(batch('app-api-worker-email-delivery'), env)
    await handleQueue(batch('app-api-worker-telegram-delivery'), env)
    await handleQueue(batch('app-api-worker-push-delivery'), env)

    expect(handleEmailQueue).toHaveBeenCalledTimes(1)
    expect(handleTelegramQueue).toHaveBeenCalledTimes(1)
    expect(handlePushQueue).toHaveBeenCalledTimes(1)
  })

  it('logs unknown queue names', async () => {
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)

    await handleQueue(batch('unknown-queue'), env)

    expect(spy).toHaveBeenCalledWith('Unknown queue', {
      queue: 'unknown-queue',
    })
  })
})
