import { vi } from 'vitest'

export type TestQueueMessage<T = unknown> = Message<T> & {
  ack: ReturnType<typeof vi.fn>
  retry: ReturnType<typeof vi.fn>
}

export function makeQueueMessage<T>(
  body: T,
  options?: { attempts?: number; id?: string },
): TestQueueMessage<T> {
  const ack = vi.fn()
  const retry = vi.fn()

  return {
    id: options?.id ?? `msg-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date(),
    body,
    attempts: options?.attempts ?? 0,
    ack,
    retry,
  } as unknown as TestQueueMessage<T>
}

export function makeQueueBatch<T>(
  queue: string,
  messages: Array<TestQueueMessage<T>>,
): MessageBatch<T> {
  return {
    queue,
    messages: messages as unknown as Message<T>[],
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  } as unknown as MessageBatch<T>
}
