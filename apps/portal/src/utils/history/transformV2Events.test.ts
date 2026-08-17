import { describe, expect, it } from 'vitest'
import type { V2Event } from '@/features/address/components/hooks/useV2HistoryForAddress'
import { transformV2EventsToSubgraphFormat } from './transformV2Events'

describe('transformV2EventsToSubgraphFormat', () => {
  it('should transform V2 events to SubgraphEvent format', () => {
    const v2Events: V2Event[] = [
      {
        name: 'Transfer',
        type: 'Transfer',
        transactionHash: '0x1234567890abcdef',
        timestamp: 1234567890,
        blockNumber: 100,
      },
    ]

    const result = transformV2EventsToSubgraphFormat(v2Events)

    expect(result).toEqual([
      {
        id: 'Transfer',
        type: 'Transfer',
        transactionID: '0x1234567890abcdef',
        timestamp: 1234567890n,
        blockNumber: 100,
      },
    ])
  })

  it('should handle multiple events', () => {
    const v2Events: V2Event[] = [
      {
        name: 'Transfer',
        type: 'Transfer',
        transactionHash: '0xabc',
        timestamp: 1000,
        blockNumber: 1,
      },
      {
        name: 'Approval',
        type: 'Approval',
        transactionHash: '0xdef',
        timestamp: 2000,
        blockNumber: 2,
      },
    ]

    const result = transformV2EventsToSubgraphFormat(v2Events)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('Transfer')
    expect(result[1].id).toBe('Approval')
  })

  it('should convert timestamp to BigInt', () => {
    const v2Events: V2Event[] = [
      {
        name: 'Test',
        type: 'Test',
        transactionHash: '0x123',
        timestamp: 9999999999,
        blockNumber: 999,
      },
    ]

    const result = transformV2EventsToSubgraphFormat(v2Events)

    expect(result[0].timestamp).toBe(9999999999n)
    expect(typeof result[0].timestamp).toBe('bigint')
  })

  it('should handle empty array', () => {
    const v2Events: V2Event[] = []

    const result = transformV2EventsToSubgraphFormat(v2Events)

    expect(result).toEqual([])
  })

  it('should use event name as id', () => {
    const v2Events: V2Event[] = [
      {
        name: 'NameRegistered',
        type: 'Registration',
        transactionHash: '0x456',
        timestamp: 5000,
        blockNumber: 50,
      },
    ]

    const result = transformV2EventsToSubgraphFormat(v2Events)

    expect(result[0].id).toBe('NameRegistered')
  })

  it('should use transactionHash as transactionID', () => {
    const v2Events: V2Event[] = [
      {
        name: 'Test',
        type: 'Test',
        transactionHash: '0xabcdef123456',
        timestamp: 1000,
        blockNumber: 1,
      },
    ]

    const result = transformV2EventsToSubgraphFormat(v2Events)

    expect(result[0].transactionID).toBe('0xabcdef123456')
  })

  it('should preserve blockNumber', () => {
    const v2Events: V2Event[] = [
      {
        name: 'Test',
        type: 'Test',
        transactionHash: '0x123',
        timestamp: 1000,
        blockNumber: 12345,
      },
    ]

    const result = transformV2EventsToSubgraphFormat(v2Events)

    expect(result[0].blockNumber).toBe(12345)
  })

  it('should preserve event type', () => {
    const v2Events: V2Event[] = [
      {
        name: 'NameRenewed',
        type: 'Renewal',
        transactionHash: '0x789',
        timestamp: 3000,
        blockNumber: 30,
      },
    ]

    const result = transformV2EventsToSubgraphFormat(v2Events)

    expect(result[0].type).toBe('Renewal')
  })
})
