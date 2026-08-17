import type { GetNameHistoryReturnType } from '@ensdomains/ensjs/subgraph'
import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { transformHistoryToEvents } from './transformHistoryToEvents'

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890' as Address
const TEST_TX_ID =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`

// Helper types for creating mock events with minimal required fields
// biome-ignore lint/suspicious/noExplicitAny: Test mock types need flexibility
type MockDomainEvent = Record<string, any>
// biome-ignore lint/suspicious/noExplicitAny: Test mock types need flexibility
type MockRegistrationEvent = Record<string, any>
// biome-ignore lint/suspicious/noExplicitAny: Test mock types need flexibility
type MockResolverEvent = Record<string, any>

describe('transformHistoryToEvents', () => {
  it('should return empty array for null/undefined history', () => {
    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input handling
    expect(transformHistoryToEvents(null as any)).toEqual([])
    // biome-ignore lint/suspicious/noExplicitAny: Testing invalid input handling
    expect(transformHistoryToEvents(undefined as any)).toEqual([])
  })

  it('should return empty array for empty history', () => {
    const history = {
      domainEvents: [],
      registrationEvents: [],
      resolverEvents: [],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)
    expect(result).toEqual([])
  })

  it('should process domain events', () => {
    const history = {
      domainEvents: [
        {
          id: 'event-1',
          type: 'Transfer',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
          owner: TEST_ADDRESS,
        } as MockDomainEvent,
      ],
      registrationEvents: [],
      resolverEvents: [],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result).toHaveLength(1)
    expect(result[0].transactionID).toBe(TEST_TX_ID)
    expect(result[0].blockNumber).toBe(100)
    expect(result[0].from).toBe(TEST_ADDRESS)
    expect(result[0].events).toHaveLength(1)
    expect(result[0].events[0].category).toBe('domain')
    expect(result[0].events[0].type).toBe('Transfer')
  })

  it('should process registration events', () => {
    const history = {
      domainEvents: [],
      registrationEvents: [
        {
          id: 'event-1',
          type: 'NameRegistered',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
          registrant: TEST_ADDRESS,
        } as MockRegistrationEvent,
      ],
      resolverEvents: [],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result).toHaveLength(1)
    expect(result[0].events[0].category).toBe('registration')
    expect(result[0].events[0].type).toBe('NameRegistered')
  })

  it('should process resolver events', () => {
    const history = {
      domainEvents: [],
      registrationEvents: [],
      resolverEvents: [
        {
          id: 'event-1',
          type: 'AddrChanged',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
          addr: TEST_ADDRESS,
        } as MockResolverEvent,
      ],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result).toHaveLength(1)
    expect(result[0].events[0].category).toBe('resolver')
    expect(result[0].events[0].type).toBe('AddrChanged')
  })

  it('should group events by transaction ID across all event types', () => {
    const history = {
      domainEvents: [
        {
          id: 'event-1',
          type: 'Transfer',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
          owner: TEST_ADDRESS,
        } as MockDomainEvent,
      ],
      registrationEvents: [
        {
          id: 'event-2',
          type: 'NameRegistered',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
          registrant: TEST_ADDRESS,
        } as MockRegistrationEvent,
      ],
      resolverEvents: [
        {
          id: 'event-3',
          type: 'AddrChanged',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
        } as MockResolverEvent,
      ],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result).toHaveLength(1)
    expect(result[0].events).toHaveLength(3)
    expect(result[0].events[0].category).toBe('domain')
    expect(result[0].events[1].category).toBe('registration')
    expect(result[0].events[2].category).toBe('resolver')
  })

  it('should separate events with different transaction IDs', () => {
    const TX_ID_2 =
      '0x9999999999999999999999999999999999999999999999999999999999999999' as `0x${string}`

    const history = {
      domainEvents: [
        {
          id: 'event-1',
          type: 'Transfer',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
        } as MockDomainEvent,
        {
          id: 'event-2',
          type: 'NewOwner',
          transactionID: TX_ID_2,
          blockNumber: 101,
        } as MockDomainEvent,
      ],
      registrationEvents: [],
      resolverEvents: [],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result).toHaveLength(2)
  })

  it('should sort transactions by block number descending', () => {
    const TX_ID_2 =
      '0x9999999999999999999999999999999999999999999999999999999999999999' as `0x${string}`

    const history = {
      domainEvents: [
        {
          id: 'event-1',
          type: 'Transfer',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
        } as MockDomainEvent,
        {
          id: 'event-2',
          type: 'NewOwner',
          transactionID: TX_ID_2,
          blockNumber: 200,
        } as MockDomainEvent,
      ],
      registrationEvents: [],
      resolverEvents: [],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result[0].blockNumber).toBe(200)
    expect(result[1].blockNumber).toBe(100)
  })

  it('should extract address from event with owner field', () => {
    const history = {
      domainEvents: [
        {
          id: 'event-1',
          type: 'Transfer',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
          owner: TEST_ADDRESS,
        } as MockDomainEvent,
      ],
      registrationEvents: [],
      resolverEvents: [],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result[0].from).toBe(TEST_ADDRESS)
  })

  it('should extract address from event with registrant field', () => {
    const history = {
      domainEvents: [],
      registrationEvents: [
        {
          id: 'event-1',
          type: 'NameRegistered',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
          registrant: TEST_ADDRESS,
        } as MockRegistrationEvent,
      ],
      resolverEvents: [],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result[0].from).toBe(TEST_ADDRESS)
  })

  it('should fallback to findAddressFromEvents when no initial address', () => {
    const history = {
      domainEvents: [
        {
          id: 'event-1',
          type: 'Transfer',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
          // No address
        } as MockDomainEvent,
        {
          id: 'event-2',
          type: 'NewOwner',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
          owner: TEST_ADDRESS,
        } as MockDomainEvent,
      ],
      registrationEvents: [],
      resolverEvents: [],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result[0].from).toBe(TEST_ADDRESS)
  })

  it('should handle optional registrationEvents array', () => {
    const history = {
      domainEvents: [
        {
          id: 'event-1',
          type: 'Transfer',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
        } as MockDomainEvent,
      ],
      registrationEvents: null,
      resolverEvents: [],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result).toHaveLength(1)
    expect(result[0].events).toHaveLength(1)
  })

  it('should handle optional resolverEvents array', () => {
    const history = {
      domainEvents: [
        {
          id: 'event-1',
          type: 'Transfer',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
        } as MockDomainEvent,
      ],
      registrationEvents: [],
      resolverEvents: null,
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result).toHaveLength(1)
    expect(result[0].events).toHaveLength(1)
  })

  it('should set network to undefined', () => {
    const history = {
      domainEvents: [
        {
          id: 'event-1',
          type: 'Transfer',
          transactionID: TEST_TX_ID,
          blockNumber: 100,
        } as MockDomainEvent,
      ],
      registrationEvents: [],
      resolverEvents: [],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result[0].network).toBeUndefined()
  })

  it('should preserve event details', () => {
    const eventDetails = {
      id: 'event-1',
      type: 'Transfer',
      transactionID: TEST_TX_ID,
      blockNumber: 100,
      owner: TEST_ADDRESS,
      customField: 'custom-value',
    }

    const history = {
      domainEvents: [eventDetails as MockDomainEvent],
      registrationEvents: [],
      resolverEvents: [],
    } as unknown as GetNameHistoryReturnType

    const result = transformHistoryToEvents(history)

    expect(result[0].events[0].details).toEqual(eventDetails)
  })
})
