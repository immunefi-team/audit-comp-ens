import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import type {
  BaseEvent,
  EventsTableData,
} from '@/components/table/EventsDataTable/types'
import {
  filterByDateRange,
  filterByEventTypes,
  groupEventTypesByCategory,
  matchesSearchFilter,
} from './eventsTableFilters'

describe('eventsTableFilters', () => {
  describe('groupEventTypesByCategory', () => {
    it('should group event types by category', () => {
      const data: EventsTableData[] = [
        {
          transactionID: '0x1',
          blockNumber: 100,
          from: null,
          events: [
            { id: '1', type: 'Transfer', category: 'domain', details: {} },
            { id: '2', type: 'NewOwner', category: 'domain', details: {} },
          ],
        },
        {
          transactionID: '0x2',
          blockNumber: 101,
          from: null,
          events: [
            {
              id: '3',
              type: 'NameRegistered',
              category: 'registration',
              details: {},
            },
            { id: '4', type: 'Transfer', category: 'domain', details: {} },
          ],
        },
      ]

      const result = groupEventTypesByCategory(data)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        title: 'Domain events',
        options: [
          { label: 'NewOwner', value: 'NewOwner' },
          { label: 'Transfer', value: 'Transfer' },
        ],
      })
      expect(result[1]).toEqual({
        title: 'Registration events',
        options: [{ label: 'NameRegistered', value: 'NameRegistered' }],
      })
    })

    it('should handle events without category as "other"', () => {
      const data: EventsTableData[] = [
        {
          transactionID: '0x1',
          blockNumber: 100,
          from: null,
          events: [
            {
              id: '1',
              type: 'CustomEvent',
              category: undefined as unknown as string,
              details: {},
            },
          ],
        },
      ]

      const result = groupEventTypesByCategory(data)

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Other events')
    })

    it('should sort event types alphabetically', () => {
      const data: EventsTableData[] = [
        {
          transactionID: '0x1',
          blockNumber: 100,
          from: null,
          events: [
            { id: '1', type: 'Zebra', category: 'domain', details: {} },
            { id: '2', type: 'Apple', category: 'domain', details: {} },
            { id: '3', type: 'Mango', category: 'domain', details: {} },
          ],
        },
      ]

      const result = groupEventTypesByCategory(data)

      expect(result[0].options).toEqual([
        { label: 'Apple', value: 'Apple' },
        { label: 'Mango', value: 'Mango' },
        { label: 'Zebra', value: 'Zebra' },
      ])
    })

    it('should deduplicate event types', () => {
      const data: EventsTableData[] = [
        {
          transactionID: '0x1',
          blockNumber: 100,
          from: null,
          events: [
            { id: '1', type: 'Transfer', category: 'domain', details: {} },
            { id: '2', type: 'Transfer', category: 'domain', details: {} },
            { id: '3', type: 'Transfer', category: 'domain', details: {} },
          ],
        },
      ]

      const result = groupEventTypesByCategory(data)

      expect(result[0].options).toHaveLength(1)
      expect(result[0].options[0].label).toBe('Transfer')
    })
  })

  describe('filterByEventTypes', () => {
    const mockData: EventsTableData[] = [
      {
        transactionID: '0x1',
        blockNumber: 100,
        from: null,
        events: [
          { id: '1', type: 'Transfer', category: 'domain', details: {} },
        ],
      },
      {
        transactionID: '0x2',
        blockNumber: 101,
        from: null,
        events: [
          {
            id: '2',
            type: 'NameRegistered',
            category: 'registration',
            details: {},
          },
        ],
      },
      {
        transactionID: '0x3',
        blockNumber: 102,
        from: null,
        events: [
          { id: '3', type: 'AddrChanged', category: 'resolver', details: {} },
        ],
      },
    ]

    it('should return all data when no event types selected', () => {
      const result = filterByEventTypes(mockData, [])

      expect(result).toHaveLength(3)
      expect(result).toEqual(mockData)
    })

    it('should filter transactions by single event type', () => {
      const result = filterByEventTypes(mockData, ['Transfer'])

      expect(result).toHaveLength(1)
      expect(result[0].transactionID).toBe('0x1')
    })

    it('should filter transactions by multiple event types', () => {
      const result = filterByEventTypes(mockData, ['Transfer', 'AddrChanged'])

      expect(result).toHaveLength(2)
      expect(result[0].transactionID).toBe('0x1')
      expect(result[1].transactionID).toBe('0x3')
    })

    it('should return transactions that contain at least one matching event', () => {
      const dataWithMultipleEvents: EventsTableData[] = [
        {
          transactionID: '0x1',
          blockNumber: 100,
          from: null,
          events: [
            { id: '1', type: 'Transfer', category: 'domain', details: {} },
            { id: '2', type: 'NewOwner', category: 'domain', details: {} },
          ],
        },
      ]

      const result = filterByEventTypes(dataWithMultipleEvents, ['Transfer'])

      expect(result).toHaveLength(1)
    })
  })

  describe('filterByDateRange', () => {
    const mockData: EventsTableData[] = [
      {
        transactionID: '0x1',
        blockNumber: 100,
        timestamp: 1609459200n, // 2021-01-01 00:00:00
        from: null,
        events: [],
      },
      {
        transactionID: '0x2',
        blockNumber: 101,
        timestamp: 1609545600n, // 2021-01-02 00:00:00
        from: null,
        events: [],
      },
      {
        transactionID: '0x3',
        blockNumber: 102,
        timestamp: 1609632000n, // 2021-01-03 00:00:00
        from: null,
        events: [],
      },
      {
        transactionID: '0x4',
        blockNumber: 103,
        from: null,
        events: [],
      },
    ]

    it('should return all data when no date range specified', () => {
      const result = filterByDateRange(mockData, {})

      expect(result).toHaveLength(4)
    })

    it('should filter by from date', () => {
      const fromDate = new Date('2021-01-02')
      const result = filterByDateRange(mockData, { from: fromDate })

      expect(result).toHaveLength(2)
      expect(result[0].transactionID).toBe('0x2')
      expect(result[1].transactionID).toBe('0x3')
    })

    it('should filter by to date including end of day', () => {
      const toDate = new Date('2021-01-02')
      const result = filterByDateRange(mockData, { to: toDate })

      expect(result).toHaveLength(2)
      expect(result[0].transactionID).toBe('0x1')
      expect(result[1].transactionID).toBe('0x2')
    })

    it('should filter by date range', () => {
      const fromDate = new Date('2021-01-01')
      const toDate = new Date('2021-01-02')
      const result = filterByDateRange(mockData, { from: fromDate, to: toDate })

      expect(result).toHaveLength(2)
      expect(result[0].transactionID).toBe('0x1')
      expect(result[1].transactionID).toBe('0x2')
    })

    it('should exclude transactions without timestamps', () => {
      const fromDate = new Date('2021-01-01')
      const result = filterByDateRange(mockData, { from: fromDate })

      expect(result.every((tx) => tx.timestamp !== undefined)).toBe(true)
      expect(result.find((tx) => tx.transactionID === '0x4')).toBeUndefined()
    })
  })

  describe('matchesSearchFilter', () => {
    const mockTx: EventsTableData<BaseEvent> = {
      transactionID: '0xABCDEF123456',
      blockNumber: 100,
      from: '0x1234567890abcdef1234567890abcdef12345678' as Address,
      events: [
        { id: '1', type: 'Transfer', category: 'domain', details: {} },
        { id: '2', type: 'NewOwner', category: 'domain', details: {} },
      ],
    }

    it('should match transaction ID (case insensitive)', () => {
      expect(matchesSearchFilter(mockTx, 'abcdef')).toBe(true)
      expect(matchesSearchFilter(mockTx, 'ABCDEF')).toBe(true)
      expect(matchesSearchFilter(mockTx, '0xabc')).toBe(true)
    })

    it('should match event type (case insensitive)', () => {
      expect(matchesSearchFilter(mockTx, 'transfer')).toBe(true)
      expect(matchesSearchFilter(mockTx, 'TRANSFER')).toBe(true)
      expect(matchesSearchFilter(mockTx, 'newowner')).toBe(true)
    })

    it('should match sender address (case insensitive)', () => {
      expect(matchesSearchFilter(mockTx, '0x1234')).toBe(true)
      expect(matchesSearchFilter(mockTx, 'ABCDEF12345678')).toBe(true)
    })

    it('should not match when search term not found', () => {
      expect(matchesSearchFilter(mockTx, 'xyz')).toBe(false)
      expect(matchesSearchFilter(mockTx, 'notfound')).toBe(false)
    })

    it('should handle transactions without sender', () => {
      const txWithoutSender: EventsTableData = {
        ...mockTx,
        from: null,
      }

      expect(matchesSearchFilter(txWithoutSender, 'transfer')).toBe(true)
      expect(matchesSearchFilter(txWithoutSender, '0x1234')).toBe(false)
    })

    it('should match partial strings', () => {
      expect(matchesSearchFilter(mockTx, 'trans')).toBe(true)
      expect(matchesSearchFilter(mockTx, 'own')).toBe(true)
      expect(matchesSearchFilter(mockTx, '123')).toBe(true)
    })
  })
})
