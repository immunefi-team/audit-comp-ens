import type { DomainFragment } from '@ens-apps/indexer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClassifiedName } from '@/features/migration/service/classifyNames'
import {
  buildMergedNamesList,
  compareMerged,
  getMergedNamesCount,
  type MergedItem,
  mergedRowMetadata,
  v1ExpirySeconds,
} from './mergedNames'

const baseV2 = {
  __typename: 'Domain' as const,
  id: '0xid',
  name: 'alice.eth',
  normalizedName: 'alice.eth',
  tokenId: null,
  createdAt: 0,
  owner: { __typename: 'Account' as const, id: '0xowner' },
}

const makeV2 = (overrides: Partial<DomainFragment> = {}): DomainFragment =>
  ({ ...baseV2, ...overrides }) as DomainFragment

const makeV1 = (
  overrides: {
    id?: string
    name?: string
    label?: string
    registrationExpiry?: string | null
    wrappedExpiry?: string | null
  } = {},
): ClassifiedName =>
  ({
    tokenType: 'unwrapped',
    label: overrides.label ?? 'bob',
    parentName: 'eth',
    fuses: 0,
    tokenHolder: '0x0',
    v1ResolverAddress: null,
    resolverStrategy: 'to-owned-permres',
    managerAddress: null,
    domain: {
      id: overrides.id ?? '0xv1',
      name: overrides.name ?? 'bob.eth',
      registration: overrides.registrationExpiry
        ? { expiryDate: overrides.registrationExpiry }
        : null,
      wrappedDomain: overrides.wrappedExpiry
        ? { expiryDate: overrides.wrappedExpiry }
        : null,
    },
  }) as unknown as ClassifiedName

const makeMergedV2 = (
  overrides: Partial<Extract<MergedItem, { kind: 'v2' }>> = {},
): MergedItem => ({
  kind: 'v2',
  key: 'v2-0xid',
  sortName: 'alice.eth',
  sortExpiry: 100,
  sortCreated: 100,
  domain: makeV2(),
  ...overrides,
})

const makeMergedV1 = (
  overrides: Partial<Extract<MergedItem, { kind: 'v1' }>> = {},
): MergedItem => ({
  kind: 'v1',
  key: 'v1-0xv1',
  sortName: 'bob.eth',
  sortExpiry: null,
  sortCreated: null,
  classified: makeV1(),
  ...overrides,
})

describe('v1ExpirySeconds', () => {
  it('prefers registration expiry over wrapped', () => {
    const c = makeV1({ registrationExpiry: '100', wrappedExpiry: '200' })
    expect(v1ExpirySeconds(c)).toBe(100)
  })

  it('falls back to wrapped when registration is missing', () => {
    expect(v1ExpirySeconds(makeV1({ wrappedExpiry: '200' }))).toBe(200)
  })

  it('returns null when both are missing', () => {
    expect(v1ExpirySeconds(makeV1())).toBeNull()
  })

  it('returns null when expiry is non-finite', () => {
    expect(
      v1ExpirySeconds(makeV1({ registrationExpiry: 'not-a-number' })),
    ).toBeNull()
  })
})

describe('compareMerged', () => {
  const a = makeMergedV2({ sortName: 'alpha.eth', sortExpiry: 10 })
  const b = makeMergedV2({ sortName: 'beta.eth', sortExpiry: 20 })
  const noExpiry = makeMergedV1({ sortName: 'gamma.eth', sortExpiry: null })
  const older = makeMergedV2({
    sortName: 'older.eth',
    sortExpiry: 20,
    sortCreated: 10,
  })
  const newer = makeMergedV2({
    sortName: 'newer.eth',
    sortExpiry: 10,
    sortCreated: 20,
  })
  const noCreated = makeMergedV1({
    sortName: 'unknown.eth',
    sortExpiry: 1,
  })

  it('sorts by name asc', () => {
    expect(compareMerged(a, b, 'name', 'asc')).toBeLessThan(0)
  })
  it('sorts by name desc', () => {
    expect(compareMerged(a, b, 'name', 'desc')).toBeGreaterThan(0)
  })
  it('sorts by expiry asc', () => {
    expect(compareMerged(a, b, 'expiry', 'asc')).toBeLessThan(0)
  })
  it('pushes null expiry to the end regardless of direction', () => {
    expect(compareMerged(a, noExpiry, 'expiry', 'asc')).toBeLessThan(0)
    expect(compareMerged(a, noExpiry, 'expiry', 'desc')).toBeLessThan(0)
  })
  it('pushes zero expiry to the end like null expiry', () => {
    const nonExpiring = makeMergedV1({
      sortName: 'non-expiring.eth',
      sortExpiry: 0,
    })
    expect(compareMerged(a, nonExpiring, 'expiry', 'asc')).toBeLessThan(0)
    expect(compareMerged(a, nonExpiring, 'expiry', 'desc')).toBeLessThan(0)
  })
  it('returns 0 when both expiries are null', () => {
    const c = makeMergedV1({ sortName: 'delta.eth', sortExpiry: null })
    expect(compareMerged(noExpiry, c, 'expiry', 'asc')).toBe(0)
  })
  it('sorts by created date and keeps unknown created dates last', () => {
    expect(compareMerged(older, newer, 'created', 'asc')).toBeLessThan(0)
    expect(compareMerged(older, noCreated, 'created', 'desc')).toBeLessThan(0)
  })
})

describe('buildMergedNamesList', () => {
  const v2Names = [
    makeV2({ id: '0x1', name: 'alpha.eth', expiryDate: 200 }),
    makeV2({ id: '0x2', name: 'zeta.eth', expiryDate: 100 }),
  ]
  const v1Classified = [
    makeV1({ id: '0x3', name: 'mike.eth', label: 'mike' }),
    makeV1({
      id: '0x4',
      name: 'beta.eth',
      label: 'beta',
      registrationExpiry: '50',
    }),
  ]

  it('merges and sorts by name asc', () => {
    const items = buildMergedNamesList({
      v2Names,
      v1Classified,
      searchQuery: '',
      sortField: 'name',
      sortDir: 'asc',
    })
    expect(items.map((i) => i.sortName)).toEqual([
      'alpha.eth',
      'beta.eth',
      'mike.eth',
      'zeta.eth',
    ])
  })

  it('filters by search query (case-insensitive)', () => {
    const items = buildMergedNamesList({
      v2Names,
      v1Classified,
      searchQuery: 'BET',
      sortField: 'name',
      sortDir: 'asc',
    })
    expect(items.map((i) => i.sortName)).toEqual(['beta.eth'])
  })

  it('matches v1 items by label as well as name', () => {
    const items = buildMergedNamesList({
      v2Names: [],
      v1Classified: [
        makeV1({ id: '0x5', name: 'full.raffy.eth', label: 'full' }),
      ],
      searchQuery: 'full',
      sortField: 'name',
      sortDir: 'asc',
    })
    expect(items).toHaveLength(1)
  })

  it('sorts by expiry asc with nulls last', () => {
    const items = buildMergedNamesList({
      v2Names,
      v1Classified,
      searchQuery: '',
      sortField: 'expiry',
      sortDir: 'asc',
    })
    expect(items.map((i) => i.sortExpiry)).toEqual([50, 100, 200, null])
  })

  it('prefers the v2 row when the same name exists in v1 and v2', () => {
    const items = buildMergedNamesList({
      v2Names: [makeV2({ id: '0xv2', name: 'migrated.eth' })],
      v1Classified: [
        makeV1({ id: '0xv1', name: 'MIGRATED.eth', label: 'MIGRATED' }),
      ],
      searchQuery: '',
      sortField: 'name',
      sortDir: 'asc',
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.kind).toBe('v2')
  })

  it('counts merged names without double-counting v1 names that exist in v2', () => {
    expect(
      getMergedNamesCount({
        v2Names: [makeV2({ id: '0xv2', name: 'migrated.eth' })],
        v1Classified: [
          makeV1({ id: '0xv1', name: 'migrated.eth', label: 'migrated' }),
          makeV1({ id: '0xv1-only', name: 'v1-only.eth', label: 'v1-only' }),
        ],
      }),
    ).toBe(2)
  })

  it('sorts by created date desc with unknowns last', () => {
    const items = buildMergedNamesList({
      v2Names: [
        makeV2({ id: '0x1', name: 'alpha.eth', createdAt: 100 }),
        makeV2({ id: '0x2', name: 'zeta.eth', createdAt: 200 }),
      ],
      v1Classified: [makeV1({ id: '0x3', name: 'mike.eth' })],
      searchQuery: '',
      sortField: 'created',
      sortDir: 'desc',
    })
    expect(items.map((i) => i.sortName)).toEqual([
      'zeta.eth',
      'alpha.eth',
      'mike.eth',
    ])
  })
})

describe('mergedRowMetadata', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('flags v2 name matching primaryLabel as primary', () => {
    const item = makeMergedV2({ sortName: 'alice.eth', sortExpiry: null })
    const meta = mergedRowMetadata(item, 'alice.eth')
    expect(meta.isPrimary).toBe(true)
    expect(meta.isV1).toBe(false)
  })

  it('never flags v1 items as primary even on label match', () => {
    const item = makeMergedV1({ sortName: 'bob.eth', sortExpiry: null })
    const meta = mergedRowMetadata(item, 'bob.eth')
    expect(meta.isPrimary).toBe(false)
    expect(meta.isV1).toBe(true)
    expect(meta.avatarUrl).toBeUndefined()
  })

  it('uses avatarOverride for v2 and ignores indexer resolver avatar', () => {
    const item = makeMergedV2({
      domain: makeV2({
        resolver: {
          __typename: 'Resolver' as const,
          id: 'r',
          address: '0x0',
          avatar: 'resolver-avatar',
        } as DomainFragment['resolver'],
      }) as DomainFragment,
    })
    expect(mergedRowMetadata(item, null, 'override').avatarUrl).toBe('override')
    expect(mergedRowMetadata(item, null).avatarUrl).toBeUndefined()
  })

  it('computes expiringSoon within 30 days', () => {
    const tenDaysFromNow = Math.floor(
      new Date('2024-01-11T00:00:00Z').getTime() / 1000,
    )
    const item = makeMergedV2({
      sortName: 'a.eth',
      sortExpiry: tenDaysFromNow,
    })
    const meta = mergedRowMetadata(item, null)
    expect(meta.expiringSoon).toBe(true)
    expect(meta.daysUntilExpiry).toBe(10)
  })

  it('labels zero expiry timestamps as non-expiring', () => {
    const item = makeMergedV1({
      sortName: 'pokemon.fgeorgescu.eth',
      sortExpiry: 0,
    })

    const meta = mergedRowMetadata(item, null)

    expect(meta.expiryDate).toBeNull()
    expect(meta.formattedExpiryDate).toBe('Does not expire')
    expect(meta.daysUntilExpiry).toBeNull()
  })

  it('uses reminder CTA for names expiring more than 7 days out', () => {
    const tenDaysFromNow = Math.floor(
      new Date('2024-01-11T00:00:00Z').getTime() / 1000,
    )
    const item = makeMergedV2({
      sortName: 'remind.eth',
      sortExpiry: tenDaysFromNow,
    })
    const meta = mergedRowMetadata(item, null)
    expect(meta.expiryCta).toBe('remindMe')
  })

  it('uses renew CTA for names expiring within 7 days', () => {
    const sevenDaysFromNow = Math.floor(
      new Date('2024-01-08T00:00:00Z').getTime() / 1000,
    )
    const item = makeMergedV2({
      sortName: 'renew.eth',
      sortExpiry: sevenDaysFromNow,
    })
    const meta = mergedRowMetadata(item, null)
    expect(meta.expiryCta).toBe('renew')
  })

  it('flags grace period metadata for expired v2 names', () => {
    const expired = Math.floor(
      new Date('2023-12-20T00:00:00Z').getTime() / 1000,
    )
    const item = makeMergedV2({ sortName: 'grace.eth', sortExpiry: expired })
    const meta = mergedRowMetadata(item, null)
    expect(meta.isInGrace).toBe(true)
    expect(meta.useDefaultAvatar).toBe(true)
    expect(meta.showProminentRenew).toBe(true)
    expect(meta.expiryCta).toBe('renew')
    expect(meta.displayExpiryDate?.getTime()).toBeGreaterThan(
      meta.expiryDate?.getTime() ?? 0,
    )
  })
})
