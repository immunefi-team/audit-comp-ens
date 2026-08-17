import { describe, expect, it } from 'vitest'
import type { NameRecord } from '@/features/records/components/RecordsTable/columns'
import { transformPendingChangesToSetRecords } from './transformPendingChanges'

describe('transformPendingChangesToSetRecords', () => {
  const originalRecords: NameRecord[] = [
    { type: 'text', key: 'name', value: 'John' },
    { type: 'text', key: 'description', value: 'Hello' },
    { type: 'address', key: 'ETH', value: '0x123', id: 60 },
    { type: 'contentHash', value: 'ipfs://abc' },
  ]

  describe('new records', () => {
    it('transforms new text records', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [{ type: 'text', key: 'twitter', value: '@ens' }],
        editedValues: new Map(),
        deletedIds: new Set(),
      })

      expect(result.texts).toEqual([{ key: 'twitter', value: '@ens' }])
    })

    it('transforms new address records', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [{ type: 'address', key: 'BTC', value: 'bc1...', id: 0 }],
        editedValues: new Map(),
        deletedIds: new Set(),
      })

      expect(result.coins).toEqual([{ coin: 0, value: 'bc1...' }])
    })

    it('transforms new contentHash record', () => {
      const result = transformPendingChangesToSetRecords([], {
        newRecords: [{ type: 'contentHash', value: 'ipfs://new' }],
        editedValues: new Map(),
        deletedIds: new Set(),
      })

      expect(result.contentHash).toBe('ipfs://new')
    })
  })

  describe('edited records', () => {
    it('transforms edited text records', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [],
        editedValues: new Map([['text-name', 'Jane']]),
        deletedIds: new Set(),
      })

      expect(result.texts).toEqual([{ key: 'name', value: 'Jane' }])
    })

    it('transforms edited address records', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [],
        editedValues: new Map([['address-ETH', '0x456']]),
        deletedIds: new Set(),
      })

      expect(result.coins).toEqual([{ coin: 60, value: '0x456' }])
    })

    it('transforms edited contentHash', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [],
        editedValues: new Map([['contentHash', 'ipfs://updated']]),
        deletedIds: new Set(),
      })

      expect(result.contentHash).toBe('ipfs://updated')
    })
  })

  describe('deleted records', () => {
    it('transforms deleted text records to empty string', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [],
        editedValues: new Map(),
        deletedIds: new Set(['text-description']),
      })

      expect(result.texts).toEqual([{ key: 'description', value: '' }])
    })

    it('transforms deleted address records to empty string', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [],
        editedValues: new Map(),
        deletedIds: new Set(['address-ETH']),
      })

      expect(result.coins).toEqual([{ coin: 60, value: '' }])
    })

    it('transforms deleted contentHash to null', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [],
        editedValues: new Map(),
        deletedIds: new Set(['contentHash']),
      })

      expect(result.contentHash).toBeNull()
    })
  })

  describe('combined changes', () => {
    it('handles multiple changes at once', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [{ type: 'text', key: 'twitter', value: '@ens' }],
        editedValues: new Map([['text-name', 'Jane']]),
        deletedIds: new Set(['text-description']),
      })

      expect(result.texts).toEqual([
        { key: 'twitter', value: '@ens' },
        { key: 'name', value: 'Jane' },
        { key: 'description', value: '' },
      ])
    })

    it('returns empty object when no changes', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [],
        editedValues: new Map(),
        deletedIds: new Set(),
      })

      expect(result).toEqual({})
    })
  })

  describe('ABI records', () => {
    it('transforms new ABI record with valid JSON object', () => {
      const result = transformPendingChangesToSetRecords([], {
        newRecords: [{ type: 'abi', value: '{"name":"test"}' }],
        editedValues: new Map(),
        deletedIds: new Set(),
      })

      expect(result.abi).toEqual({ encodeAs: 'json', data: { name: 'test' } })
    })

    it('transforms new ABI record with valid JSON array', () => {
      const result = transformPendingChangesToSetRecords([], {
        newRecords: [{ type: 'abi', value: '[{"name":"test"}]' }],
        editedValues: new Map(),
        deletedIds: new Set(),
      })

      expect(result.abi).toEqual({ encodeAs: 'json', data: [{ name: 'test' }] })
    })

    it('transforms edited ABI record', () => {
      const recordsWithAbi: NameRecord[] = [
        { type: 'abi', value: '{"old":"value"}' },
      ]

      const result = transformPendingChangesToSetRecords(recordsWithAbi, {
        newRecords: [],
        editedValues: new Map([['abi', '{"new":"value"}']]),
        deletedIds: new Set(),
      })

      expect(result.abi).toEqual({ encodeAs: 'json', data: { new: 'value' } })
    })

    it('transforms deleted ABI record to null', () => {
      const recordsWithAbi: NameRecord[] = [
        { type: 'abi', value: '{"test":"value"}' },
      ]

      const result = transformPendingChangesToSetRecords(recordsWithAbi, {
        newRecords: [],
        editedValues: new Map(),
        deletedIds: new Set(['abi']),
      })

      expect(result.abi).toEqual({ encodeAs: 'json', data: null })
    })

    it('handles empty ABI value as null', () => {
      const result = transformPendingChangesToSetRecords([], {
        newRecords: [{ type: 'abi', value: '' }],
        editedValues: new Map(),
        deletedIds: new Set(),
      })

      expect(result.abi).toEqual({ encodeAs: 'json', data: null })
    })

    it('does not include ABI with invalid JSON', () => {
      const result = transformPendingChangesToSetRecords([], {
        newRecords: [{ type: 'abi', value: 'not valid json' }],
        editedValues: new Map(),
        deletedIds: new Set(),
      })

      // Invalid JSON is silently skipped (returns undefined from parseAbiValue)
      expect(result.abi).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('ignores edited records not found in original', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [],
        editedValues: new Map([['text-nonexistent', 'value']]),
        deletedIds: new Set(),
      })

      expect(result).toEqual({})
    })

    it('ignores deleted records not found in original', () => {
      const result = transformPendingChangesToSetRecords(originalRecords, {
        newRecords: [],
        editedValues: new Map(),
        deletedIds: new Set(['text-nonexistent']),
      })

      expect(result).toEqual({})
    })
  })
})
