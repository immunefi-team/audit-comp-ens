import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  extractEventAddress,
  findAddressFromEvents,
} from './extractEventAddress'

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890' as Address
const TEST_ADDRESS_2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Address

describe('extractEventAddress', () => {
  describe('owner field extraction', () => {
    it('should extract owner address', () => {
      const event = { owner: TEST_ADDRESS }
      expect(extractEventAddress(event)).toBe(TEST_ADDRESS)
    })

    it('should prioritize owner over other fields', () => {
      const event = {
        owner: TEST_ADDRESS,
        registrant: TEST_ADDRESS_2,
        newOwner: '0x0000000000000000000000000000000000000000' as Address,
      }
      expect(extractEventAddress(event)).toBe(TEST_ADDRESS)
    })
  })

  describe('registrant field extraction', () => {
    it('should extract registrant address when no owner', () => {
      const event = { registrant: TEST_ADDRESS }
      expect(extractEventAddress(event)).toBe(TEST_ADDRESS)
    })

    it('should prioritize registrant over newOwner', () => {
      const event = {
        registrant: TEST_ADDRESS,
        newOwner: TEST_ADDRESS_2,
      }
      expect(extractEventAddress(event)).toBe(TEST_ADDRESS)
    })
  })

  describe('newOwner field extraction', () => {
    it('should extract newOwner address when no owner or registrant', () => {
      const event = { newOwner: TEST_ADDRESS }
      expect(extractEventAddress(event)).toBe(TEST_ADDRESS)
    })

    it('should extract newOwner as last resort', () => {
      const event = {
        resolver: TEST_ADDRESS_2,
        newOwner: TEST_ADDRESS,
      }
      expect(extractEventAddress(event)).toBe(TEST_ADDRESS)
    })
  })

  describe('no address found', () => {
    it('should return null when no address fields present', () => {
      const event = { name: 'vitalik.eth', timestamp: 123456 }
      expect(extractEventAddress(event)).toBeNull()
    })

    it('should return null for empty object', () => {
      expect(extractEventAddress({})).toBeNull()
    })

    it('should NOT extract from "addr" field (resolver addresses)', () => {
      const event = { addr: TEST_ADDRESS }
      expect(extractEventAddress(event)).toBeNull()
    })
  })

  describe('type safety', () => {
    it('should ignore non-string owner values', () => {
      const event = { owner: 123 }
      expect(extractEventAddress(event)).toBeNull()
    })

    it('should ignore non-string registrant values', () => {
      const event = { registrant: true }
      expect(extractEventAddress(event)).toBeNull()
    })

    it('should ignore non-string newOwner values', () => {
      const event = { newOwner: null }
      expect(extractEventAddress(event)).toBeNull()
    })

    it('should handle nested objects gracefully', () => {
      const event = { owner: { nested: TEST_ADDRESS } }
      expect(extractEventAddress(event)).toBeNull()
    })
  })

  describe('complex event structures', () => {
    it('should work with typical Transfer event', () => {
      const event = {
        type: 'Transfer',
        owner: TEST_ADDRESS,
        blockNumber: 12345,
      }
      expect(extractEventAddress(event)).toBe(TEST_ADDRESS)
    })

    it('should work with typical NameRegistered event', () => {
      const event = {
        type: 'NameRegistered',
        name: 'test.eth',
        registrant: TEST_ADDRESS,
        expiryDate: 1704067200,
      }
      expect(extractEventAddress(event)).toBe(TEST_ADDRESS)
    })

    it('should work with typical NameTransferred event', () => {
      const event = {
        type: 'NameTransferred',
        name: 'test.eth',
        newOwner: TEST_ADDRESS,
      }
      expect(extractEventAddress(event)).toBe(TEST_ADDRESS)
    })
  })
})

describe('findAddressFromEvents', () => {
  it('should find address from first event with valid address', () => {
    const events = [
      { details: { name: 'test.eth' } },
      { details: { owner: TEST_ADDRESS } },
      { details: { owner: TEST_ADDRESS_2 } },
    ]
    expect(findAddressFromEvents(events)).toBe(TEST_ADDRESS)
  })

  it('should return null when no events have addresses', () => {
    const events = [
      { details: { name: 'test.eth' } },
      { details: { timestamp: 123456 } },
    ]
    expect(findAddressFromEvents(events)).toBeNull()
  })

  it('should return null for empty event list', () => {
    expect(findAddressFromEvents([])).toBeNull()
  })

  it('should skip events without addresses and find first valid one', () => {
    const events = [
      { details: { name: 'test1.eth' } },
      { details: { resolver: '0x0000000000000000000000000000000000000000' } },
      { details: { registrant: TEST_ADDRESS } },
      { details: { owner: TEST_ADDRESS_2 } },
    ]
    expect(findAddressFromEvents(events)).toBe(TEST_ADDRESS)
  })

  it('should handle events with nested details', () => {
    const events = [
      { details: { owner: TEST_ADDRESS, nested: { data: 'value' } } },
    ]
    expect(findAddressFromEvents(events)).toBe(TEST_ADDRESS)
  })

  it('should handle mixed event types', () => {
    const events = [
      { details: { type: 'AddrChanged', addr: TEST_ADDRESS_2 } }, // Should skip (addr field)
      { details: { type: 'Transfer', owner: TEST_ADDRESS } }, // Should find
    ]
    expect(findAddressFromEvents(events)).toBe(TEST_ADDRESS)
  })
})
