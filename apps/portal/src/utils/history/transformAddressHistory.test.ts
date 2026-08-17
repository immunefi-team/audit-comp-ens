import type { Hash } from 'viem'
import { describe, expect, it } from 'vitest'
import type { EventsTableData } from '@/components/table/EventsDataTable/types'
import {
  extractBlocksNeedingTimestamps,
  extractTransactionHashes,
  mergeAndSortEvents,
  transformAndMergeAddressHistory,
  transformV1EventsToCommon,
  transformV2EventsToCommon,
  type V1Events,
  type V2Event,
} from './transformAddressHistory'
import type { ENSEvent } from './transformHistoryToEvents'

describe('transformAddressHistory', () => {
  describe('transformV1EventsToCommon', () => {
    it('should return empty array when no V1 events provided', () => {
      const result = transformV1EventsToCommon(undefined)
      expect(result).toEqual([])
    })

    it('should return empty array when V1 events are empty', () => {
      const v1Events: V1Events = {
        domainEvents: [],
        registrationEvents: [],
        resolverEvents: [],
      }
      const result = transformV1EventsToCommon(v1Events)
      expect(result).toEqual([])
    })

    it('should transform and group V1 domain events', () => {
      const v1Events: V1Events = {
        domainEvents: [
          {
            id: 'event1',
            transactionID: '0xabc123',
            blockNumber: 100,
            type: 'Transfer',
          },
          {
            id: 'event2',
            transactionID: '0xabc123',
            blockNumber: 100,
            type: 'NewOwner',
          },
        ],
        registrationEvents: [],
        resolverEvents: [],
      }

      const result = transformV1EventsToCommon(v1Events)

      expect(result).toHaveLength(1)
      expect(result[0].transactionID).toBe('0xabc123')
      expect(result[0].blockNumber).toBe(100)
      expect(result[0].events).toHaveLength(2)
      expect(result[0].events[0].type).toBe('Transfer')
      expect(result[0].events[1].type).toBe('NewOwner')
    })

    it('should transform and group events from all V1 categories', () => {
      const v1Events: V1Events = {
        domainEvents: [
          {
            id: 'domain1',
            transactionID: '0xabc123',
            blockNumber: 100,
            type: 'Transfer',
          },
        ],
        registrationEvents: [
          {
            id: 'reg1',
            transactionID: '0xabc123',
            blockNumber: 100,
            type: 'NameRegistered',
          },
        ],
        resolverEvents: [
          {
            id: 'resolver1',
            transactionID: '0xdef456',
            blockNumber: 101,
            type: 'AddrChanged',
          },
        ],
      }

      const result = transformV1EventsToCommon(v1Events)

      expect(result).toHaveLength(2) // 2 different transactions
      // Sorted by block number descending, so block 101 comes first
      expect(result[0].blockNumber).toBe(101)
      expect(result[0].events).toHaveLength(1) // 1 event in first tx (block 101)
      expect(result[1].blockNumber).toBe(100)
      expect(result[1].events).toHaveLength(2) // 2 events in second tx (block 100)
    })

    it('should not create duplicate keys for same transaction events', () => {
      const v1Events: V1Events = {
        domainEvents: [
          {
            id: 'event1',
            transactionID: '0xsametx',
            blockNumber: 100,
            type: 'Transfer',
          },
          {
            id: 'event2',
            transactionID: '0xsametx',
            blockNumber: 100,
            type: 'NewOwner',
          },
          {
            id: 'event3',
            transactionID: '0xsametx',
            blockNumber: 100,
            type: 'NewResolver',
          },
        ],
        registrationEvents: [],
        resolverEvents: [],
      }

      const result = transformV1EventsToCommon(v1Events)

      // All events should be grouped into a single transaction
      expect(result).toHaveLength(1)
      expect(result[0].transactionID).toBe('0xsametx')
      expect(result[0].events).toHaveLength(3)
    })
  })

  describe('transformV2EventsToCommon', () => {
    it('should return empty array when no V2 events provided', () => {
      const result = transformV2EventsToCommon(undefined)
      expect(result).toEqual([])
    })

    it('should return empty array when V2 events are empty', () => {
      const result = transformV2EventsToCommon([])
      expect(result).toEqual([])
    })

    it('should transform V2 events with timestamps', () => {
      const v2Events: V2Event[] = [
        {
          transactionHash: '0x123abc',
          blockNumber: 200,
          name: 'test.eth',
          type: 'NameRegistered',
          timestamp: 1700000000,
        },
        {
          transactionHash: '0x123abc',
          blockNumber: 200,
          name: 'test.eth',
          type: 'Transfer',
          timestamp: 1700000000,
        },
      ]

      const result = transformV2EventsToCommon(v2Events)

      expect(result).toHaveLength(1)
      expect(result[0].transactionID).toBe('0x123abc')
      expect(result[0].blockNumber).toBe(200)
      expect(result[0].timestamp).toBe(1700000000n)
      expect(result[0].events).toHaveLength(2)
    })

    it('should group V2 events by transaction hash', () => {
      const v2Events: V2Event[] = [
        {
          transactionHash: '0xaaa',
          blockNumber: 200,
          name: 'test1.eth',
          type: 'Transfer',
          timestamp: 1700000000,
        },
        {
          transactionHash: '0xbbb',
          blockNumber: 201,
          name: 'test2.eth',
          type: 'Transfer',
          timestamp: 1700000001,
        },
      ]

      const result = transformV2EventsToCommon(v2Events)

      expect(result).toHaveLength(2)
      // Sorted by block number descending, so block 201 comes first
      expect(result[0].transactionID).toBe('0xbbb')
      expect(result[0].blockNumber).toBe(201)
      expect(result[1].transactionID).toBe('0xaaa')
      expect(result[1].blockNumber).toBe(200)
    })
  })

  describe('mergeAndSortEvents', () => {
    it('should merge V1 and V2 events', () => {
      const v1Events: EventsTableData<ENSEvent>[] = [
        {
          transactionID: '0xv1',
          blockNumber: 100,
          from: null,
          events: [
            {
              id: 'v1-event',
              type: 'Transfer',
              category: 'domain',
              details: {},
            },
          ],
        },
      ]

      const v2Events: EventsTableData<ENSEvent>[] = [
        {
          transactionID: '0xv2',
          blockNumber: 200,
          from: null,
          events: [
            {
              id: 'v2-event',
              type: 'Transfer',
              category: 'domain',
              details: {},
            },
          ],
          timestamp: 1700000000n,
        },
      ]

      const result = mergeAndSortEvents(v1Events, v2Events)

      expect(result).toHaveLength(2)
    })

    it('should sort events by block number descending', () => {
      const v1Events: EventsTableData<ENSEvent>[] = [
        {
          transactionID: '0x1',
          blockNumber: 100,
          from: null,
          events: [],
        },
        {
          transactionID: '0x2',
          blockNumber: 300,
          from: null,
          events: [],
        },
      ]

      const v2Events: EventsTableData<ENSEvent>[] = [
        {
          transactionID: '0x3',
          blockNumber: 200,
          from: null,
          events: [],
        },
      ]

      const result = mergeAndSortEvents(v1Events, v2Events)

      expect(result).toHaveLength(3)
      expect(result[0].blockNumber).toBe(300)
      expect(result[1].blockNumber).toBe(200)
      expect(result[2].blockNumber).toBe(100)
    })

    it('should handle empty arrays', () => {
      const result = mergeAndSortEvents([], [])
      expect(result).toEqual([])
    })

    it('should handle one empty array', () => {
      const v1Events: EventsTableData<ENSEvent>[] = [
        {
          transactionID: '0x1',
          blockNumber: 100,
          from: null,
          events: [],
        },
      ]

      const result1 = mergeAndSortEvents(v1Events, [])
      expect(result1).toHaveLength(1)

      const result2 = mergeAndSortEvents([], v1Events)
      expect(result2).toHaveLength(1)
    })
  })

  describe('extractBlocksNeedingTimestamps', () => {
    it('should extract blocks without timestamps', () => {
      const events: EventsTableData<ENSEvent>[] = [
        {
          transactionID: '0x1',
          blockNumber: 100,
          from: null,
          events: [],
          // No timestamp
        },
        {
          transactionID: '0x2',
          blockNumber: 200,
          from: null,
          events: [],
          timestamp: 1700000000n,
        },
        {
          transactionID: '0x3',
          blockNumber: 300,
          from: null,
          events: [],
          // No timestamp
        },
      ]

      const result = extractBlocksNeedingTimestamps(events)

      expect(result).toHaveLength(2)
      expect(result).toContain(100n)
      expect(result).toContain(300n)
      expect(result).not.toContain(200n)
    })

    it('should return empty array when all events have timestamps', () => {
      const events: EventsTableData<ENSEvent>[] = [
        {
          transactionID: '0x1',
          blockNumber: 100,
          from: null,
          events: [],
          timestamp: 1700000000n,
        },
      ]

      const result = extractBlocksNeedingTimestamps(events)
      expect(result).toEqual([])
    })

    it('should return all blocks when no events have timestamps', () => {
      const events: EventsTableData<ENSEvent>[] = [
        {
          transactionID: '0x1',
          blockNumber: 100,
          from: null,
          events: [],
        },
        {
          transactionID: '0x2',
          blockNumber: 200,
          from: null,
          events: [],
        },
      ]

      const result = extractBlocksNeedingTimestamps(events)
      expect(result).toHaveLength(2)
      expect(result).toContain(100n)
      expect(result).toContain(200n)
    })
  })

  describe('extractTransactionHashes', () => {
    it('should extract all transaction hashes', () => {
      const events: EventsTableData<ENSEvent>[] = [
        {
          transactionID: '0xabc123' as Hash,
          blockNumber: 100,
          from: null,
          events: [],
        },
        {
          transactionID: '0xdef456' as Hash,
          blockNumber: 200,
          from: null,
          events: [],
        },
      ]

      const result = extractTransactionHashes(events)

      expect(result).toHaveLength(2)
      expect(result).toContain('0xabc123')
      expect(result).toContain('0xdef456')
    })

    it('should return empty array for empty events', () => {
      const result = extractTransactionHashes([])
      expect(result).toEqual([])
    })

    it('should extract hashes in order', () => {
      const events: EventsTableData<ENSEvent>[] = [
        {
          transactionID: '0x111' as Hash,
          blockNumber: 300,
          from: null,
          events: [],
        },
        {
          transactionID: '0x222' as Hash,
          blockNumber: 200,
          from: null,
          events: [],
        },
        {
          transactionID: '0x333' as Hash,
          blockNumber: 100,
          from: null,
          events: [],
        },
      ]

      const result = extractTransactionHashes(events)

      expect(result).toHaveLength(3)
      expect(result[0]).toBe('0x111')
      expect(result[1]).toBe('0x222')
      expect(result[2]).toBe('0x333')
    })
  })

  describe('transformAndMergeAddressHistory', () => {
    it('should return empty array when no events provided', () => {
      const result = transformAndMergeAddressHistory(undefined, undefined)
      expect(result).toEqual([])
    })

    it('should transform and merge V1 events only', () => {
      const v1Events: V1Events = {
        domainEvents: [
          {
            id: 'event1',
            transactionID: '0xabc123',
            blockNumber: 100,
            type: 'Transfer',
          },
        ],
        registrationEvents: [],
        resolverEvents: [],
      }

      const result = transformAndMergeAddressHistory(v1Events, undefined)

      expect(result).toHaveLength(1)
      expect(result[0].transactionID).toBe('0xabc123')
      expect(result[0].blockNumber).toBe(100)
    })

    it('should transform and merge V2 events only', () => {
      const v2Events: V2Event[] = [
        {
          transactionHash: '0xdef456',
          blockNumber: 200,
          name: 'vitalik.eth',
          type: 'Transfer',
          timestamp: 1700000000,
        },
      ]

      const result = transformAndMergeAddressHistory(undefined, v2Events)

      expect(result).toHaveLength(1)
      expect(result[0].transactionID).toBe('0xdef456')
      expect(result[0].blockNumber).toBe(200)
      expect(result[0].timestamp).toBe(1700000000n)
    })

    it('should transform and merge both V1 and V2 events', () => {
      const v1Events: V1Events = {
        domainEvents: [
          {
            id: 'event1',
            transactionID: '0xabc123',
            blockNumber: 100,
            type: 'Transfer',
          },
        ],
        registrationEvents: [],
        resolverEvents: [],
      }

      const v2Events: V2Event[] = [
        {
          transactionHash: '0xdef456',
          blockNumber: 200,
          name: 'vitalik.eth',
          type: 'Transfer',
          timestamp: 1700000000,
        },
      ]

      const result = transformAndMergeAddressHistory(v1Events, v2Events)

      expect(result).toHaveLength(2)
      // Should be sorted by block number descending
      expect(result[0].blockNumber).toBe(200) // V2 event
      expect(result[1].blockNumber).toBe(100) // V1 event
    })

    it('should sort merged events by block number descending', () => {
      const v1Events: V1Events = {
        domainEvents: [
          {
            id: 'event3',
            transactionID: '0x333',
            blockNumber: 300,
            type: 'Transfer',
          },
          {
            id: 'event1',
            transactionID: '0x111',
            blockNumber: 100,
            type: 'Transfer',
          },
        ],
        registrationEvents: [],
        resolverEvents: [],
      }

      const v2Events: V2Event[] = [
        {
          transactionHash: '0x222',
          blockNumber: 200,
          name: 'vitalik.eth',
          type: 'Transfer',
          timestamp: 1700000000,
        },
      ]

      const result = transformAndMergeAddressHistory(v1Events, v2Events)

      expect(result).toHaveLength(3)
      expect(result[0].blockNumber).toBe(300)
      expect(result[1].blockNumber).toBe(200)
      expect(result[2].blockNumber).toBe(100)
    })
  })
})
