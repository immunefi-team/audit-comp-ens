import type { DomainFragment } from '@ens-apps/indexer'
import { describe, expect, it } from 'vitest'
import type { V1Domain } from '@/features/migration/service/v1SubgraphClient'
import {
  buildProfileAddressNames,
  isDisplayableProfileName,
} from './buildProfileAddressNames'
import { testAddress, testV1Names } from './profileAddressNames.test.helpers'

const makeV1Domain = (
  name: string,
  overrides: Partial<V1Domain> = {},
): V1Domain => ({
  id: `v1-${name}`,
  labelName: name.replace('.eth', ''),
  labelhash: `0x${name}`,
  name,
  resolver: null,
  owner: { id: testAddress.toLowerCase() },
  registrant: { id: testAddress.toLowerCase() },
  wrappedOwner: null,
  parent: null,
  registration: { expiryDate: '1893456000' },
  wrappedDomain: null,
  ...overrides,
})

const makeV2Domain = (
  name: string,
  createdAt = 1_700_000_000,
): DomainFragment =>
  ({
    __typename: 'Domain',
    id: `v2-${name}`,
    name,
    normalizedName: name,
    tokenId: null,
    createdAt,
    expiryDate: 1_891_036_800,
    owner: {
      __typename: 'Account',
      id: testAddress.toLowerCase(),
    },
    resolver: null,
  }) as DomainFragment

describe('isDisplayableProfileName', () => {
  it('filters reverse records', () => {
    expect(
      isDisplayableProfileName(
        '[28a26e44a0fccc45a84d01c90b99a91310b083fb0050af6be1762db4147487a1].addr.reverse',
      ),
    ).toBe(false)
    expect(isDisplayableProfileName('figma.eth')).toBe(true)
  })
})

describe('buildProfileAddressNames', () => {
  it('includes v1 and v2 names for the fixture address', () => {
    const names = buildProfileAddressNames({
      address: testAddress,
      v1Domains: testV1Names.map((name) => makeV1Domain(name)),
      v2Domains: [
        makeV2Domain('henlo.eth', 1_700_000_300),
        makeV2Domain('claude.eth', 1_700_000_200),
        makeV2Domain('alaska.eth', 1_700_000_100),
      ],
    })

    expect(names.map((item) => item.label)).toEqual([
      'henlo.eth',
      'claude.eth',
      'alaska.eth',
      'figma.eth',
      'sagar.eth',
      'turbopuffer.eth',
    ])
  })

  it('labels v1-only names as protocol v1', () => {
    const names = buildProfileAddressNames({
      address: testAddress,
      v1Domains: [makeV1Domain('figma.eth')],
      v2Domains: [makeV2Domain('henlo.eth')],
    })

    expect(names.find((item) => item.label === 'figma.eth')?.protocol).toBe(
      'v1',
    )
    expect(names.find((item) => item.label === 'henlo.eth')?.protocol).toBe(
      'v2',
    )
  })

  it('prefers the v2 row when the same name exists in both protocols', () => {
    const names = buildProfileAddressNames({
      address: testAddress,
      v1Domains: [makeV1Domain('figma.eth')],
      v2Domains: [makeV2Domain('figma.eth')],
    })

    expect(names.filter((item) => item.label === 'figma.eth')).toHaveLength(1)
    expect(names.find((item) => item.label === 'figma.eth')?.protocol).toBe(
      'v2',
    )
  })

  it('returns an empty list when no names are associated with the address', () => {
    expect(
      buildProfileAddressNames({
        address: testAddress,
        v1Domains: [],
        v2Domains: [],
      }),
    ).toEqual([])
  })

  it('includes managed-only v2 names with manager role and managed category', () => {
    const names = buildProfileAddressNames({
      address: testAddress,
      v1Domains: [],
      v2Domains: [makeV2Domain('henlo.eth')],
      managedV2Domains: [
        {
          ...makeV2Domain('dom.eth'),
          owner: { __typename: 'Account', id: '0xother' },
        } as DomainFragment,
      ],
      roleAssignments: [{ name: 'dom.eth', roleBitmap: '1' }],
    })

    const managed = names.find((item) => item.label === 'dom.eth')
    expect(managed?.protocol).toBe('v2')
    expect(managed?.nameRoles).toEqual(['manager'])
    expect(managed?.roleCategory).toBe('managed')

    const owned = names.find((item) => item.label === 'henlo.eth')
    expect(owned?.nameRoles).toEqual(['owner'])
    expect(owned?.roleCategory).toBe('owned')
  })

  it('marks owned names with role assignments as owner and manager', () => {
    const names = buildProfileAddressNames({
      address: testAddress,
      v1Domains: [],
      v2Domains: [makeV2Domain('henlo.eth')],
      roleAssignments: [{ name: 'henlo.eth', roleBitmap: '1' }],
    })

    expect(names.find((item) => item.label === 'henlo.eth')?.nameRoles).toEqual(
      ['owner', 'manager'],
    )
    expect(names.find((item) => item.label === 'henlo.eth')?.roleCategory).toBe(
      'owned',
    )
  })
})
