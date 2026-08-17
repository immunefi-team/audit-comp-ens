import { describe, expect, it } from 'vitest'
import { filterEventDetailsMetadata } from './filterEventDetailsMetadata'

describe('filterEventDetailsMetadata', () => {
  it('should filter out all metadata fields', () => {
    const details = {
      id: 'event-1',
      blockNumber: 123,
      transactionID: '0xabc',
      type: 'Transfer',
      from: '0x123',
      to: '0x456',
      amount: '1000',
    }

    const result = filterEventDetailsMetadata(details)

    expect(result).toEqual([
      ['from', '0x123'],
      ['to', '0x456'],
      ['amount', '1000'],
    ])
  })

  it('should return all fields when no metadata fields present', () => {
    const details = {
      from: '0x123',
      to: '0x456',
      value: '1000',
    }

    const result = filterEventDetailsMetadata(details)

    expect(result).toEqual([
      ['from', '0x123'],
      ['to', '0x456'],
      ['value', '1000'],
    ])
  })

  it('should return empty array when only metadata fields present', () => {
    const details = {
      id: 'event-1',
      blockNumber: 123,
      transactionID: '0xabc',
      type: 'Transfer',
    }

    const result = filterEventDetailsMetadata(details)

    expect(result).toEqual([])
  })
})
