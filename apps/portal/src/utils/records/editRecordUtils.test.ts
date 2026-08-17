import { describe, expect, it } from 'vitest'
import {
  createNewRecord,
  type EditableRecord,
  getRecordId,
  mergeRecordsWithChanges,
} from './editRecordUtils'

describe('getRecordId', () => {
  it('returns "contentHash" for contentHash records without _uid', () => {
    expect(getRecordId({ type: 'contentHash', value: 'ipfs://abc' })).toBe(
      'contentHash',
    )
  })

  it('returns "contentHash-{_uid}" for contentHash records with _uid', () => {
    expect(
      getRecordId({ type: 'contentHash', value: 'ipfs://abc', _uid: 'abc123' }),
    ).toBe('contentHash-abc123')
  })

  it('returns "abi" for abi records without _uid', () => {
    expect(getRecordId({ type: 'abi', value: '[{"type":"function"}]' })).toBe(
      'abi',
    )
  })

  it('returns "abi-{_uid}" for abi records with _uid', () => {
    expect(
      getRecordId({
        type: 'abi',
        value: '[{"type":"function"}]',
        _uid: 'xyz789',
      }),
    ).toBe('abi-xyz789')
  })

  it('returns "address-{key}" for address records without _uid', () => {
    expect(
      getRecordId({ type: 'address', key: 'ETH', value: '0x123', id: 60 }),
    ).toBe('address-ETH')
    expect(
      getRecordId({ type: 'address', key: 'BTC', value: 'bc1...', id: 0 }),
    ).toBe('address-BTC')
  })

  it('returns "address-{key}-{_uid}" for address records with _uid', () => {
    expect(
      getRecordId({
        type: 'address',
        key: 'ETH',
        value: '0x123',
        id: 60,
        _uid: 'def456',
      }),
    ).toBe('address-ETH-def456')
  })

  it('returns "text-{key}" for text records without _uid', () => {
    expect(getRecordId({ type: 'text', key: 'name', value: 'John' })).toBe(
      'text-name',
    )
    expect(
      getRecordId({ type: 'text', key: 'description', value: 'Hello' }),
    ).toBe('text-description')
  })

  it('returns "text-{key}-{_uid}" for text records with _uid', () => {
    expect(
      getRecordId({
        type: 'text',
        key: 'name',
        value: 'John',
        _uid: 'ghi012',
      }),
    ).toBe('text-name-ghi012')
  })
})

describe('mergeRecordsWithChanges', () => {
  const originalRecords = [
    { type: 'text' as const, key: 'name', value: 'John' },
    { type: 'text' as const, key: 'bio', value: 'Hello' },
    { type: 'address' as const, key: 'ETH', value: '0x123', id: 60 },
  ]

  it('returns original records unchanged when no changes', () => {
    const result = mergeRecordsWithChanges(
      originalRecords,
      [],
      new Map(),
      new Set(),
    )

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ type: 'text', key: 'name', value: 'John' })
    expect(result[1]).toEqual({ type: 'text', key: 'bio', value: 'Hello' })
  })

  it('marks edited records with isEdited flag and updates value', () => {
    const editedValues = new Map([['text-name', 'Jane']])

    const result = mergeRecordsWithChanges(
      originalRecords,
      [],
      editedValues,
      new Set(),
    )

    expect(result[0]).toEqual({
      type: 'text',
      key: 'name',
      value: 'Jane',
      isEdited: true,
    })
    expect(result[1]).toEqual({ type: 'text', key: 'bio', value: 'Hello' })
  })

  it('marks deleted records with isDeleted flag', () => {
    const deletedIds = new Set(['text-bio'])

    const result = mergeRecordsWithChanges(
      originalRecords,
      [],
      new Map(),
      deletedIds,
    )

    expect(result[1]).toEqual({
      type: 'text',
      key: 'bio',
      value: 'Hello',
      isDeleted: true,
    })
  })

  it('adds new records with isNew flag', () => {
    const newRecords: EditableRecord[] = [
      { type: 'text', key: 'twitter', value: '@john' },
    ]

    const result = mergeRecordsWithChanges(
      originalRecords,
      newRecords,
      new Map(),
      new Set(),
    )

    expect(result).toHaveLength(4)
    expect(result[3]).toEqual({
      type: 'text',
      key: 'twitter',
      value: '@john',
      isNew: true,
    })
  })

  it('handles multiple changes at once', () => {
    const newRecords: EditableRecord[] = [
      { type: 'text', key: 'twitter', value: '@john' },
    ]
    const editedValues = new Map([['text-name', 'Jane']])
    const deletedIds = new Set(['text-bio'])

    const result = mergeRecordsWithChanges(
      originalRecords,
      newRecords,
      editedValues,
      deletedIds,
    )

    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({ value: 'Jane', isEdited: true })
    expect(result[1]).toMatchObject({ isDeleted: true })
    expect(result[3]).toMatchObject({ key: 'twitter', isNew: true })
  })

  it('prioritizes deletion over edit', () => {
    const editedValues = new Map([['text-name', 'Jane']])
    const deletedIds = new Set(['text-name'])

    const result = mergeRecordsWithChanges(
      originalRecords,
      [],
      editedValues,
      deletedIds,
    )

    expect(result[0]).toMatchObject({ isDeleted: true })
    expect(result[0]).not.toHaveProperty('isEdited')
  })
})

describe('createNewRecord', () => {
  it('creates a text record with unique _uid', () => {
    const record = createNewRecord('text', 'name', 'John')

    expect(record).toMatchObject({
      type: 'text',
      key: 'name',
      value: 'John',
    })
    expect(record._uid).toBeDefined()
    expect(typeof record._uid).toBe('string')
  })

  it('creates unique _uids for multiple records', () => {
    const record1 = createNewRecord('text', 'name', 'John')
    const record2 = createNewRecord('text', 'name', 'Jane')

    expect(record1._uid).not.toBe(record2._uid)
  })

  it('creates an ETH address record with coin type 60', () => {
    const record = createNewRecord('address', 'ETH', '0x123')

    expect(record).toMatchObject({
      type: 'address',
      key: 'ETH',
      value: '0x123',
      id: 60,
    })
    expect(record._uid).toBeDefined()
  })

  it('creates a BTC address record with coin type 0', () => {
    const record = createNewRecord('address', 'btc', 'bc1...')

    expect(record).toMatchObject({
      type: 'address',
      key: 'btc',
      value: 'bc1...',
      id: 0,
    })
    expect(record._uid).toBeDefined()
  })

  it('creates a SOL address record with correct coin type', () => {
    const record = createNewRecord(
      'address',
      'sol',
      'So11111111111111111111111111111111111111112',
    )

    expect(record).toMatchObject({
      type: 'address',
      key: 'sol',
      value: 'So11111111111111111111111111111111111111112',
      id: 501,
    })
    expect(record._uid).toBeDefined()
  })

  it('defaults to ETH coin type (60) for unknown coin names', () => {
    const record = createNewRecord('address', 'UNKNOWN', 'someaddress')

    expect(record).toMatchObject({
      type: 'address',
      key: 'UNKNOWN',
      value: 'someaddress',
      id: 60,
    })
    expect(record._uid).toBeDefined()
  })

  it('creates a contentHash record', () => {
    const record = createNewRecord('contentHash', '', 'ipfs://abc')

    expect(record).toMatchObject({
      type: 'contentHash',
      value: 'ipfs://abc',
    })
    expect(record._uid).toBeDefined()
  })

  it('creates ABI record without key', () => {
    const record = createNewRecord('abi', '', '[{"type":"function"}]')

    expect(record).toMatchObject({
      type: 'abi',
      value: '[{"type":"function"}]',
    })
    expect(record._uid).toBeDefined()
  })
})
