import type { DomainFragment } from '@ens-apps/indexer'
import { describe, expect, it } from 'vitest'
import {
  applyProfileV2RoleAssignments,
  applyV2RoleAssignments,
  getManagedOnlyRoleNames,
} from './v2NameRoles'

const makeDomain = (overrides: Partial<DomainFragment> = {}): DomainFragment =>
  ({
    __typename: 'Domain',
    id: overrides.id ?? '0x1',
    name: overrides.name ?? 'alaska.eth',
    normalizedName: overrides.normalizedName ?? overrides.name ?? 'alaska.eth',
    tokenId: overrides.tokenId ?? null,
    createdAt: overrides.createdAt ?? 0,
    expiryDate: overrides.expiryDate ?? null,
    owner: overrides.owner ?? {
      __typename: 'Account',
      id: '0xowner',
    },
    resolver: overrides.resolver ?? null,
  }) as DomainFragment

describe('applyV2RoleAssignments', () => {
  it('adds manager to owned V2 domains with a non-zero role bitmap', () => {
    const [domain] = applyV2RoleAssignments(
      [makeDomain()],
      [{ name: 'alaska.eth', roleBitmap: '1' }],
    )

    expect(domain?.nameRoles).toEqual(['owner', 'manager'])
  })

  it('keeps only owner when a V2 domain has no roles for the address', () => {
    const [domain] = applyV2RoleAssignments([makeDomain()], [])

    expect(domain?.nameRoles).toEqual(['owner'])
  })

  it('matches role assignments against normalized domain names', () => {
    const [domain] = applyV2RoleAssignments(
      [makeDomain({ name: 'Alaska.eth', normalizedName: 'alaska.eth' })],
      [{ name: 'alaska.eth', roleBitmap: '0x2' }],
    )

    expect(domain?.nameRoles).toEqual(['owner', 'manager'])
  })

  it('ignores invalid role bitmaps', () => {
    const [domain] = applyV2RoleAssignments(
      [makeDomain()],
      [{ name: 'alaska.eth', roleBitmap: 'not-a-number' }],
    )

    expect(domain?.nameRoles).toEqual(['owner'])
  })
})

describe('getManagedOnlyRoleNames', () => {
  it('returns role names that are not already owned', () => {
    expect(
      getManagedOnlyRoleNames(
        [makeDomain({ name: 'alaska.eth' })],
        [
          { name: 'alaska.eth', roleBitmap: '1' },
          { name: 'dom.eth', roleBitmap: '2' },
          { name: 'zero.eth', roleBitmap: '0' },
        ],
      ),
    ).toEqual(['dom.eth'])
  })
})

describe('applyProfileV2RoleAssignments', () => {
  it('labels managed-only domains as manager and owned domains as owner', () => {
    const names = applyProfileV2RoleAssignments({
      ownedDomains: [makeDomain({ name: 'henlo.eth', id: 'owned' })],
      managedDomains: [
        makeDomain({
          name: 'dom.eth',
          id: 'managed',
          owner: { __typename: 'Account', id: '0xother' },
        }),
      ],
      assignments: [{ name: 'dom.eth', roleBitmap: '1' }],
    })

    expect(names.find((item) => item.name === 'henlo.eth')?.nameRoles).toEqual([
      'owner',
    ])
    expect(names.find((item) => item.name === 'dom.eth')?.nameRoles).toEqual([
      'manager',
    ])
  })

  it('dedupes managed domains that overlap an owned domain under any name key', () => {
    // Managed domain has no `name`, so resolveDomainLabel falls back to its
    // id, while its normalizedName still matches the owned domain.
    const managedDomain = {
      ...makeDomain({
        id: '0xmanaged',
        owner: { __typename: 'Account', id: '0xother' },
      }),
      name: null,
      normalizedName: 'henlo.eth',
    } as DomainFragment

    const names = applyProfileV2RoleAssignments({
      ownedDomains: [makeDomain({ name: 'henlo.eth', id: 'owned' })],
      managedDomains: [managedDomain],
      assignments: [{ name: 'henlo.eth', roleBitmap: '1' }],
    })

    expect(names).toHaveLength(1)
    expect(names[0]?.nameRoles).toEqual(['owner', 'manager'])
  })
})
