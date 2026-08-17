import { describe, expect, it } from 'vitest'
import type { TimelineIndexerEvent } from '../hooks/useNameHistoryTimeline'
import { getDecodedParamEntries, getTimelineFieldType } from './eventFieldTypes'

const baseEvent = {
  id: '1',
  transactionHash: '0xabc',
  blockNumber: 1,
  timestamp: 1,
} as const

describe('getTimelineFieldType', () => {
  it('returns ABI types for known event fields', () => {
    expect(getTimelineFieldType('TextChanged', 'key')).toBe('string')
    expect(getTimelineFieldType('FusesSet', 'fuses')).toBe('uint32')
    expect(getTimelineFieldType('AddressChanged', 'address')).toBe('bytes')
    expect(getTimelineFieldType('ExpiryUpdated', 'expiry')).toBe('uint64')
    expect(getTimelineFieldType('SubregistryUpdated', 'subregistry')).toBe(
      'address',
    )
    expect(getTimelineFieldType('SubregistryUpdated', 'canonicalId')).toBe(
      'uint256',
    )
    expect(getTimelineFieldType('SubregistryUpdated', 'sender')).toBe('address')
  })

  it('returns unknown for unmapped types or fields', () => {
    expect(getTimelineFieldType('TextChanged', 'missing')).toBe('unknown')
    expect(getTimelineFieldType('SomeFutureEvent', 'key')).toBe('unknown')
  })
})

describe('getDecodedParamEntries', () => {
  it('selects the typed payload for event.type', () => {
    const event = {
      ...baseEvent,
      type: 'TextChanged',
      asTextChanged: {
        key: 'url',
        value: 'https://ens.domains',
        resolver: '0x1111111111111111111111111111111111111111',
        namehash:
          '0x0000000000000000000000000000000000000000000000000000000000000001',
      },
      // Would win under first-non-null scanning — must be ignored.
      asAddressChanged: {
        address: '0x2222222222222222222222222222222222222222',
        coinType: 60,
      },
    } as TimelineIndexerEvent

    expect(getDecodedParamEntries(event)).toEqual([
      ['key', 'url'],
      ['value', 'https://ens.domains'],
      ['resolver', '0x1111111111111111111111111111111111111111'],
      [
        'namehash',
        '0x0000000000000000000000000000000000000000000000000000000000000001',
      ],
    ])
  })

  it('maps AddrChanged onto asAddressChanged', () => {
    const event = {
      ...baseEvent,
      type: 'AddrChanged',
      asAddressChanged: {
        address: '0x3333333333333333333333333333333333333333',
        coinType: 60,
      },
    } as TimelineIndexerEvent

    expect(getDecodedParamEntries(event)).toEqual([
      ['address', '0x3333333333333333333333333333333333333333'],
      ['coinType', '60'],
    ])
  })

  it('falls back to parsing event.data when no typed payload exists', () => {
    const event = {
      ...baseEvent,
      type: 'EACRolesChanged',
      data: JSON.stringify({
        account: '0x4444444444444444444444444444444444444444',
        resource: '1',
      }),
    } as TimelineIndexerEvent

    expect(getDecodedParamEntries(event)).toEqual([
      ['account', '0x4444444444444444444444444444444444444444'],
      ['resource', '1'],
    ])
  })

  it('drops null and empty values', () => {
    const event = {
      ...baseEvent,
      type: 'FusesSet',
      asFusesSet: { node: '0x01', fuses: null },
    } as TimelineIndexerEvent

    expect(getDecodedParamEntries(event)).toEqual([['node', '0x01']])
  })
})
