import type { Address } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import type { SubgraphEvent } from './groupEventsByTransactionId'

const { groupEventsByTransactionId: groupEvents } = await import(
  './groupEventsByTransactionId'
)

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890' as Address
const TEST_TX_ID =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

describe('groupEventsByTransactionId', () => {
  it('should return empty array for empty events', () => {
    const result = groupEvents([], 'domain')
    expect(result).toEqual([])
  })

  it('should group single event', () => {
    const events: SubgraphEvent[] = [
      {
        transactionID: TEST_TX_ID,
        blockNumber: 100,
        id: 'event-1',
        type: 'Transfer',
        owner: TEST_ADDRESS,
      } as unknown as SubgraphEvent,
    ]

    const result = groupEvents(events, 'domain')

    expect(result).toHaveLength(1)
    expect(result[0].transactionID).toBe(TEST_TX_ID)
    expect(result[0].blockNumber).toBe(100)
    expect(result[0].from).toBe(TEST_ADDRESS)
    expect(result[0].events).toHaveLength(1)
    expect(result[0].events[0].category).toBe('domain')
  })

  it('should group multiple events with same transaction ID', () => {
    const events: SubgraphEvent[] = [
      {
        transactionID: TEST_TX_ID,
        blockNumber: 100,
        id: 'event-1',
        type: 'Transfer',
        owner: TEST_ADDRESS,
      } as unknown as SubgraphEvent,
      {
        transactionID: TEST_TX_ID,
        blockNumber: 100,
        id: 'event-2',
        type: 'NewOwner',
        owner: TEST_ADDRESS,
      } as unknown as SubgraphEvent,
    ]

    const result = groupEvents(events, 'domain')

    expect(result).toHaveLength(1)
    expect(result[0].events).toHaveLength(2)
    expect(result[0].events[0].id).toBe('event-1')
    expect(result[0].events[1].id).toBe('event-2')
  })

  it('should separate events with different transaction IDs', () => {
    const TX_ID_2 =
      '0x9999999999999999999999999999999999999999999999999999999999999999'

    const events: SubgraphEvent[] = [
      {
        transactionID: TEST_TX_ID,
        blockNumber: 100,
        id: 'event-1',
        type: 'Transfer',
        owner: TEST_ADDRESS,
      } as unknown as SubgraphEvent,
      {
        transactionID: TX_ID_2,
        blockNumber: 101,
        id: 'event-2',
        type: 'NewOwner',
        owner: TEST_ADDRESS,
      } as unknown as SubgraphEvent,
    ]

    const result = groupEvents(events, 'domain')

    expect(result).toHaveLength(2)
  })

  it('should sort by block number descending', () => {
    const TX_ID_2 =
      '0x9999999999999999999999999999999999999999999999999999999999999999'

    const events: SubgraphEvent[] = [
      {
        transactionID: TEST_TX_ID,
        blockNumber: 100,
        id: 'event-1',
        type: 'Transfer',
      } as unknown as SubgraphEvent,
      {
        transactionID: TX_ID_2,
        blockNumber: 200,
        id: 'event-2',
        type: 'NewOwner',
      } as unknown as SubgraphEvent,
    ]

    const result = groupEvents(events, 'domain')

    expect(result[0].blockNumber).toBe(200)
    expect(result[1].blockNumber).toBe(100)
  })

  it('should extract address from events and set category', () => {
    const events: SubgraphEvent[] = [
      {
        transactionID: TEST_TX_ID,
        blockNumber: 100,
        id: 'event-1',
        type: 'Transfer',
        owner: TEST_ADDRESS,
        timestamp: 1704067200n,
      } as unknown as SubgraphEvent,
    ]

    const result = groupEvents(events, 'domain')

    expect(result[0].from).toBe(TEST_ADDRESS)
    expect(result[0].events[0].category).toBe('domain')
    expect(result[0].timestamp).toBe(1704067200n)
  })

  it('should return null for address when no address fields found', () => {
    const events: SubgraphEvent[] = [
      {
        transactionID: TEST_TX_ID,
        blockNumber: 100,
        id: 'event-1',
        type: 'ContenthashChanged',
      } as unknown as SubgraphEvent,
    ]

    const result = groupEvents(events, 'resolver')
    expect(result[0].from).toBeNull()
  })
})
