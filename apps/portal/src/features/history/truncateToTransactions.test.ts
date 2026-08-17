import { describe, expect, it } from 'vitest'
import type { TimelineIndexerEvent } from './hooks/useNameHistoryTimeline'
import { summarizeEvents } from './summarize/summarizeEvents'
import { truncateToTransactions } from './truncateToTransactions'

const event = (
  tx: string,
  type: string,
  timestamp: number,
): TimelineIndexerEvent => ({
  id: `${tx}-${type}-${timestamp}`,
  type,
  transactionHash: `0x${tx}` as const,
  blockNumber: timestamp,
  timestamp,
})

describe('truncateToTransactions', () => {
  it('returns everything when under the limit', () => {
    const events = [event('a', 'TextChanged', 3), event('b', 'AddrChanged', 2)]
    expect(truncateToTransactions(events, 10)).toEqual(events)
  })

  it('stops before a transaction that would exceed the limit', () => {
    const events = [
      event('a', 'TextChanged', 3),
      event('a', 'AddrChanged', 3),
      // Taking any of these would split the transaction.
      event('b', 'TextChanged', 2),
      event('b', 'AddrChanged', 2),
      event('b', 'NameRegistered', 2),
    ]

    const kept = truncateToTransactions(events, 4)

    expect(kept).toHaveLength(2)
    expect(new Set(kept.map((e) => e.transactionHash))).toEqual(
      new Set(['0xa']),
    )
  })

  it('keeps a single transaction larger than the limit rather than emptying', () => {
    const events = [
      event('a', 'TextChanged', 1),
      event('a', 'AddrChanged', 1),
      event('a', 'NameRegistered', 1),
    ]
    expect(truncateToTransactions(events, 2)).toHaveLength(3)
  })

  it('groups a transaction whose events are not contiguous', () => {
    // Two transactions in the same block share a timestamp, so a stable sort
    // can interleave them.
    const events = [
      event('a', 'TextChanged', 5),
      event('b', 'TextChanged', 5),
      event('a', 'AddrChanged', 5),
    ]

    const kept = truncateToTransactions(events, 2)

    expect(kept.map((e) => e.transactionHash)).toEqual(['0xa', '0xa'])
  })

  it('never hands summarizeEvents a partial transaction', () => {
    // The regression: slicing the flat array at 2 would drop NameRegistered
    // and relabel the registration as a record write.
    const events = [
      event('a', 'TextChanged', 9),
      event('b', 'TextChanged', 5),
      event('b', 'AddrChanged', 5),
      event('b', 'NameRegistered', 5),
    ]

    const sliced = summarizeEvents(events.slice(0, 2))
    expect(sliced.at(-1)?.label).toBe('Set text record')

    const truncated = summarizeEvents(truncateToTransactions(events, 2))
    expect(truncated.map((action) => action.label)).toEqual(['Set text record'])
  })
})
