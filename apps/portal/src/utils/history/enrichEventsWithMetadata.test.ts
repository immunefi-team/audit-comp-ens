import type { Address, Hash } from 'viem'
import { describe, expect, it } from 'vitest'
import type { EventsTableData } from '@/components/table/EventsDataTable/types'
import { enrichEventsWithMetadata } from './enrichEventsWithMetadata'

describe('enrichEventsWithMetadata', () => {
  it('should enrich events with timestamps and senders', () => {
    const eventsData: EventsTableData[] = [
      {
        transactionID: '0xabc123',
        blockNumber: 100,
        from: null,
        events: [
          { id: 'e1', type: 'Transfer', category: 'domain', details: {} },
        ],
      },
      {
        transactionID: '0xdef456',
        blockNumber: 200,
        from: '0xoriginal' as Address,
        events: [
          { id: 'e2', type: 'NewOwner', category: 'domain', details: {} },
        ],
      },
    ]

    const timestampsData = new Map<bigint, bigint>([
      [100n, 1678886400n],
      [200n, 1678972800n],
    ])

    const sendersData = new Map<Hash, Address>([
      ['0xabc123' as Hash, '0xsender1' as Address],
      ['0xdef456' as Hash, '0xsender2' as Address],
    ])

    const result = enrichEventsWithMetadata(
      eventsData,
      timestampsData,
      sendersData,
    )

    expect(result).toEqual([
      {
        transactionID: '0xabc123',
        blockNumber: 100,
        timestamp: 1678886400n,
        from: '0xsender1',
        events: [
          { id: 'e1', type: 'Transfer', category: 'domain', details: {} },
        ],
      },
      {
        transactionID: '0xdef456',
        blockNumber: 200,
        timestamp: 1678972800n,
        from: '0xsender2',
        events: [
          { id: 'e2', type: 'NewOwner', category: 'domain', details: {} },
        ],
      },
    ])
  })

  it('should return empty array when metadata is undefined', () => {
    const eventsData: EventsTableData[] = [
      {
        transactionID: '0xabc123',
        blockNumber: 100,
        from: null,
        events: [],
      },
    ]

    const result = enrichEventsWithMetadata(eventsData, undefined, undefined)

    expect(result).toEqual([])
  })

  it('should fall back to existing from field when sender not found', () => {
    const eventsData: EventsTableData[] = [
      {
        transactionID: '0xabc123',
        blockNumber: 100,
        from: '0xoriginal' as Address,
        events: [],
      },
    ]

    const timestampsData = new Map<bigint, bigint>([[100n, 1678886400n]])
    const sendersData = new Map<Hash, Address>() // Empty map

    const result = enrichEventsWithMetadata(
      eventsData,
      timestampsData,
      sendersData,
    )

    expect(result[0].from).toBe('0xoriginal')
  })

  it('should set from to null when sender not found and from was null', () => {
    const eventsData: EventsTableData[] = [
      {
        transactionID: '0xabc123',
        blockNumber: 100,
        from: null,
        events: [],
      },
    ]

    const timestampsData = new Map<bigint, bigint>([[100n, 1678886400n]])
    const sendersData = new Map<Hash, Address>() // Empty map

    const result = enrichEventsWithMetadata(
      eventsData,
      timestampsData,
      sendersData,
    )

    expect(result[0].from).toBeNull()
  })

  it('should set timestamp to undefined when block number not found in map', () => {
    const eventsData: EventsTableData[] = [
      {
        transactionID: '0xabc123',
        blockNumber: 999, // Not in map
        from: null,
        events: [],
      },
    ]

    const timestampsData = new Map<bigint, bigint>([[100n, 1678886400n]])
    const sendersData = new Map<Hash, Address>([
      ['0xabc123' as Hash, '0xsender1' as Address],
    ])

    const result = enrichEventsWithMetadata(
      eventsData,
      timestampsData,
      sendersData,
    )

    expect(result[0].timestamp).toBeUndefined()
  })
})
