import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./app', () => ({
  default: {
    fetch: vi.fn(async () => new Response('ok')),
  },
}))

vi.mock('./queues', () => ({
  handleQueue: vi.fn(async () => undefined),
}))

vi.mock('./scheduled', () => ({
  handleScheduled: vi.fn(async () => undefined),
}))

import { handleQueue } from './queues'
import { handleScheduled } from './scheduled'
import worker from './worker'

function batch(queue: string): MessageBatch {
  return {
    queue,
    messages: [],
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  } as unknown as MessageBatch
}

describe('worker export', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes fetch/queue/scheduled handlers', () => {
    expect(typeof worker.fetch).toBe('function')
    expect(typeof worker.queue).toBe('function')
    expect(typeof worker.scheduled).toBe('function')
  })

  it('wires scheduled handler without uncaught throw', async () => {
    await expect(
      worker.scheduled?.(
        {
          cron: '0 */1 * * *',
          scheduledTime: Date.now(),
        } as ScheduledController,
        {} as CloudflareBindings,
        {} as ExecutionContext,
      ),
    ).resolves.toBeUndefined()

    expect(handleScheduled).toHaveBeenCalledTimes(1)
  })

  it('wires queue handler', async () => {
    await worker.queue?.(
      batch('app-api-worker-event-ingestion'),
      {} as CloudflareBindings,
    )

    expect(handleQueue).toHaveBeenCalledTimes(1)
  })
})
