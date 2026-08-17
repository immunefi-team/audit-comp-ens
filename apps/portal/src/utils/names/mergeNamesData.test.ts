import { describe, expect, it } from 'vitest'
import type { V1Name, V2Name } from './mergeNamesData'
import { mergeNamesData } from './mergeNamesData'

const defaultRelation = {
  owner: false,
  registrant: false,
  wrappedOwner: false,
  resolvedAddress: false,
}

describe('mergeNamesData', () => {
  it('should merge V1 and V2 names with proper network labels', () => {
    const v1Names: V1Name[] = [
      {
        name: 'vitalik.eth',
        expiryDate: { date: new Date('2025-01-01') },
        relation: { ...defaultRelation, registrant: true },
      },
    ]
    const v2Names: V2Name[] = [
      {
        name: 'alice.eth',
        expiryDate: 1735689600, // 2025-01-01 00:00:00 UTC
        subdomains: [],
      },
    ]

    const result = mergeNamesData(v1Names, v2Names)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      name: 'vitalik.eth',
      expiryDate: new Date('2025-01-01'),
      protocolVersion: 'ENSv1',
      roleBitmap: null,
      v1Roles: { owner: true, manager: false },
    })
    expect(result[1]).toEqual({
      name: 'alice.eth',
      expiryDate: new Date('2025-01-01 00:00:00 UTC'),
      protocolVersion: 'ENSv2',
      subdomainCount: 0,
      recordCount: undefined,
      roleBitmap: null,
      v1Roles: null,
    })
  })

  it('should handle V1 names with null expiryDate', () => {
    const v1Names: V1Name[] = [
      { name: 'test.eth', expiryDate: null, relation: defaultRelation },
    ]
    const v2Names: V2Name[] = []

    const result = mergeNamesData(v1Names, v2Names)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'test.eth',
      expiryDate: null,
      protocolVersion: 'ENSv1',
      roleBitmap: null,
      v1Roles: { owner: false, manager: false },
    })
  })

  it('should handle V1 names with expiryDate.date as null', () => {
    const v1Names: V1Name[] = [
      {
        name: 'test.eth',
        expiryDate: { date: null },
        relation: defaultRelation,
      },
    ]
    const v2Names: V2Name[] = []

    const result = mergeNamesData(v1Names, v2Names)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'test.eth',
      expiryDate: null,
      protocolVersion: 'ENSv1',
      roleBitmap: null,
      v1Roles: { owner: false, manager: false },
    })
  })

  it('should handle V2 names with null expiryDate', () => {
    const v1Names: V1Name[] = []
    const v2Names: V2Name[] = [
      { name: 'test.eth', expiryDate: null, subdomains: [] },
    ]

    const result = mergeNamesData(v1Names, v2Names)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'test.eth',
      expiryDate: null,
      protocolVersion: 'ENSv2',
      subdomainCount: 0,
      recordCount: undefined,
      roleBitmap: null,
      v1Roles: null,
    })
  })

  it('should handle undefined V1 names', () => {
    const v2Names: V2Name[] = [
      { name: 'alice.eth', expiryDate: 1735689600, subdomains: [] },
    ]

    const result = mergeNamesData(undefined, v2Names)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'alice.eth',
      expiryDate: new Date('2025-01-01 00:00:00 UTC'),
      protocolVersion: 'ENSv2',
      subdomainCount: 0,
      recordCount: undefined,
      roleBitmap: null,
      v1Roles: null,
    })
  })

  it('should handle undefined V2 names', () => {
    const v1Names: V1Name[] = [
      {
        name: 'vitalik.eth',
        expiryDate: { date: new Date('2025-01-01') },
        relation: { ...defaultRelation, wrappedOwner: true },
      },
    ]

    const result = mergeNamesData(v1Names, undefined)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'vitalik.eth',
      expiryDate: new Date('2025-01-01'),
      protocolVersion: 'ENSv1',
      roleBitmap: null,
      v1Roles: { owner: true, manager: true },
    })
  })

  it('should handle empty arrays', () => {
    const result = mergeNamesData([], [])

    expect(result).toEqual([])
  })

  it('should correctly convert V2 number timestamps to dates', () => {
    const v2Names: V2Name[] = [
      { name: 'test1.eth', expiryDate: 0, subdomains: [] }, // Unix epoch
      { name: 'test2.eth', expiryDate: 1609459200, subdomains: [] }, // 2021-01-01 00:00:00 UTC
    ]

    const result = mergeNamesData([], v2Names)

    expect(result).toHaveLength(2)
    expect(result[0].expiryDate).toEqual(new Date('1970-01-01 00:00:00 UTC'))
    expect(result[1].expiryDate).toEqual(new Date('2021-01-01 00:00:00 UTC'))
  })

  it('should preserve order: V1 names first, then V2 names', () => {
    const v1Names: V1Name[] = [
      { name: 'v1-first.eth', expiryDate: null, relation: defaultRelation },
      { name: 'v1-second.eth', expiryDate: null, relation: defaultRelation },
    ]
    const v2Names: V2Name[] = [
      { name: 'v2-first.eth', expiryDate: null, subdomains: [] },
      { name: 'v2-second.eth', expiryDate: null, subdomains: [] },
    ]

    const result = mergeNamesData(v1Names, v2Names)

    expect(result).toHaveLength(4)
    expect(result[0].name).toBe('v1-first.eth')
    expect(result[1].name).toBe('v1-second.eth')
    expect(result[2].name).toBe('v2-first.eth')
    expect(result[3].name).toBe('v2-second.eth')
  })

  it('should correctly count subdomains for V2 names', () => {
    const v2Names: V2Name[] = [
      {
        name: 'parent.eth',
        expiryDate: 1735689600,
        subdomains: [
          { name: 'sub1.parent.eth' },
          { name: 'sub2.parent.eth' },
          { name: 'sub3.parent.eth' },
        ],
      },
      {
        name: 'empty.eth',
        expiryDate: 1735689600,
        subdomains: [],
      },
    ]

    const result = mergeNamesData([], v2Names)

    expect(result).toHaveLength(2)
    expect(result[0].subdomainCount).toBe(3)
    expect(result[1].subdomainCount).toBe(0)
  })

  it('should not include subdomainCount for V1 names', () => {
    const v1Names: V1Name[] = [
      {
        name: 'test.eth',
        expiryDate: { date: new Date('2025-01-01') },
        relation: defaultRelation,
      },
    ]

    const result = mergeNamesData(v1Names, [])

    expect(result).toHaveLength(1)
    expect(result[0]).not.toHaveProperty('subdomainCount')
  })

  it('should correctly map V1 roles for wrapped names', () => {
    const v1Names: V1Name[] = [
      {
        name: 'wrapped.eth',
        expiryDate: { date: new Date('2025-01-01') },
        relation: { ...defaultRelation, wrappedOwner: true },
      },
    ]

    const result = mergeNamesData(v1Names, [])

    expect(result[0].v1Roles).toEqual({ owner: true, manager: true })
  })

  it('should correctly map V1 roles for unwrapped names with both owner and registrant', () => {
    const v1Names: V1Name[] = [
      {
        name: 'unwrapped.eth',
        expiryDate: { date: new Date('2025-01-01') },
        relation: { ...defaultRelation, owner: true, registrant: true },
      },
    ]

    const result = mergeNamesData(v1Names, [])

    expect(result[0].v1Roles).toEqual({ owner: true, manager: true })
  })

  it('should correctly map V1 roles for manager-only names', () => {
    const v1Names: V1Name[] = [
      {
        name: 'manager-only.eth',
        expiryDate: { date: new Date('2025-01-01') },
        relation: { ...defaultRelation, owner: true },
      },
    ]

    const result = mergeNamesData(v1Names, [])

    expect(result[0].v1Roles).toEqual({ owner: false, manager: true })
  })
})
