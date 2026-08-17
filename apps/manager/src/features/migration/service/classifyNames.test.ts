import { describe, expect, it } from 'vitest'
import {
  makeDomain,
  OTHER,
  OWNER,
  DEFAULT_RESOLVER as RESOLVER,
} from './_fixtures'
import {
  type ClassifiedName,
  classifyName,
  classifyNames,
  FUSES,
  groupClassifiedNames,
} from './classifyNames'
import type { V1Domain } from './v1SubgraphClient'

const classify = (o: Parameters<typeof makeDomain>[0] = {}) =>
  classifyName(makeDomain(o), OWNER)

const classified = (r: ReturnType<typeof classifyName>): ClassifiedName => {
  if (r?.type !== 'classified') throw new Error('not classified')
  return r.name
}
const ineligibleReason = (r: ReturnType<typeof classifyName>) => {
  if (r?.type !== 'ineligible') throw new Error('not ineligible')
  return r.name.reason
}

describe('classifyName — early returns', () => {
  it.each([
    ['labelName is null', { labelName: null }, 'unknown-label'] as const,
    [
      'labelName is hex-bracket placeholder',
      { labelName: `[${'0'.repeat(64)}]`, name: `[${'0'.repeat(64)}].eth` },
      'unknown-label',
    ] as const,
  ])('marks ineligible when %s', (_, overrides, reason) => {
    expect(ineligibleReason(classify(overrides))).toBe(reason)
  })

  it.each([
    ['unwrapped registrant mismatch', { registrantId: OTHER }],
    ['unwrapped registrant missing', { registrantId: null }],
    ['unwrapped parent is not eth', { parentName: 'raffy.eth' }],
    [
      'wrapped wrappedOwner mismatch',
      { isWrapped: true, wrappedOwnerId: OTHER },
    ],
    ['registrant id is not an Address', { registrantId: 'not-an-address' }],
    [
      'wrappedOwner id is not an Address',
      { isWrapped: true, wrappedOwnerId: 'not-an-address' },
    ],
  ])('returns null when %s', (_, overrides) => {
    expect(classify(overrides)).toBeNull()
  })
})

describe('classifyName — expired wrap', () => {
  it('treats wrapped .eth 2LD as unwrapped when wrappedDomain.expiryDate is in the past', () => {
    const n = classified(
      classify({
        isWrapped: true,
        wrappedExpiry: '100',
        wrappedOwnerId: OTHER,
        fuses: FUSES.PARENT_CANNOT_CONTROL | FUSES.IS_DOT_ETH,
      }),
    )
    expect(n.tokenType).toBe('unwrapped')
    expect(n.fuses).toBe(0n)
    expect(n.tokenHolder.toLowerCase()).toBe(OWNER.toLowerCase())
  })

  it('keeps a wrapped-owner candidate when subgraph wrapper expiry is stale', () => {
    const n = classified(
      classify({
        isWrapped: true,
        registrantId: OTHER,
        wrappedExpiry: '100',
        fuses: FUSES.PARENT_CANNOT_CONTROL | FUSES.IS_DOT_ETH,
      }),
    )
    expect(n.tokenType).toBe('unlocked')
    expect(n.fuses).toBe(FUSES.PARENT_CANNOT_CONTROL | FUSES.IS_DOT_ETH)
    expect(n.tokenHolder.toLowerCase()).toBe(OWNER.toLowerCase())
  })
})

describe('classifyName — grace period registrations', () => {
  it('marks wrapped .eth 2LD in registration grace as ineligible', () => {
    expect(
      ineligibleReason(
        classify({
          isWrapped: true,
          registrationExpiry: '100',
          wrappedExpiry: '99999999999',
          fuses: FUSES.PARENT_CANNOT_CONTROL | FUSES.IS_DOT_ETH,
        }),
      ),
    ).toBe('expired-registration')
  })
})

describe('classifyName — token type', () => {
  it('unwrapped 2LD: keeps custom v1 resolver, flags manager when registry owner differs', () => {
    const n = classified(classify())
    expect(n.tokenType).toBe('unwrapped')
    expect(n.v1ResolverAddress).toBe(RESOLVER)
    expect(n.resolverStrategy).toBe('keep-v1')
    expect(n.managerAddress).toBeNull()
    expect(n.tokenHolder.toLowerCase()).toBe(OWNER.toLowerCase())

    const MANAGER = '0x0000000000000000000000000000000000000099'
    expect(
      classified(classify({ ownerId: MANAGER })).managerAddress?.toLowerCase(),
    ).toBe(MANAGER.toLowerCase())
  })

  it('unwrapped with no v1 resolver routes to owned-permres', () => {
    const n = classified(classify({ resolverAddress: null }))
    expect(n.v1ResolverAddress).toBeNull()
    expect(n.resolverStrategy).toBe('to-owned-permres')
  })

  it.each([
    [
      'unlocked when wrapped and CANNOT_UNWRAP not burnt',
      { isWrapped: true, fuses: 0n },
      'unlocked' as const,
    ],
    [
      'locked-2ld when CANNOT_UNWRAP burnt and parent is eth',
      { isWrapped: true, fuses: FUSES.CANNOT_UNWRAP },
      'locked-2ld' as const,
    ],
    [
      'locked-child when CANNOT_UNWRAP burnt and parent is not eth',
      {
        isWrapped: true,
        fuses: FUSES.CANNOT_UNWRAP,
        parentName: 'raffy.eth',
      },
      'locked-child' as const,
    ],
    [
      'detached-child when PARENT_CANNOT_CONTROL burnt and parent is locked',
      {
        isWrapped: true,
        parentName: 'raffy.eth',
        parentFuses: FUSES.CANNOT_UNWRAP,
        fuses: FUSES.PARENT_CANNOT_CONTROL,
      },
      'detached-child' as const,
    ],
  ])('classifies %s', (_, overrides, tokenType) => {
    expect(classified(classify(overrides)).tokenType).toBe(tokenType)
  })
})

describe('classifyName — ineligible reasons', () => {
  it.each([
    [
      'unlocked-subname',
      { isWrapped: true, parentName: 'raffy.eth', fuses: 0n },
    ],
    [
      'not-transferable',
      {
        isWrapped: true,
        fuses: FUSES.CANNOT_UNWRAP | FUSES.CANNOT_TRANSFER,
      },
    ],
    [
      'missing-parent',
      {
        isWrapped: true,
        fuses: FUSES.CANNOT_UNWRAP,
        parentName: null,
      },
    ],
  ] as const)('flags %s', (reason, overrides) => {
    expect(ineligibleReason(classify(overrides))).toBe(reason)
  })

  it('does not classify as detached when parent is unlocked', () => {
    expect(
      ineligibleReason(
        classify({
          isWrapped: true,
          parentName: 'raffy.eth',
          parentFuses: 0n,
          fuses: FUSES.PARENT_CANNOT_CONTROL,
        }),
      ),
    ).toBe('unlocked-subname')
  })
})

describe('classifyName — resolver strategy for locked', () => {
  const locked = (extra: Parameters<typeof classify>[0] = {}) =>
    classified(
      classify({
        isWrapped: true,
        fuses: FUSES.CANNOT_UNWRAP,
        ...extra,
      }),
    )

  it.each([
    [
      'keep-v1 when CANNOT_SET_RESOLVER burnt and v1 resolver exists',
      { fuses: FUSES.CANNOT_UNWRAP | FUSES.CANNOT_SET_RESOLVER },
      'keep-v1' as const,
    ],
    [
      'keep-v1 when CANNOT_SET_RESOLVER burnt and the v1 resolver is empty',
      {
        fuses: FUSES.CANNOT_UNWRAP | FUSES.CANNOT_SET_RESOLVER,
        resolverAddress: null,
      },
      'keep-v1' as const,
    ],
    [
      'keep-v1 with custom v1 resolver even without CANNOT_SET_RESOLVER',
      {},
      'keep-v1' as const,
    ],
  ] as const)('routes to %s', (_, overrides, strategy) => {
    expect(locked(overrides).resolverStrategy).toBe(strategy)
  })
})

describe('classifyNames', () => {
  it('splits classified and ineligible across many inputs', () => {
    const domains: V1Domain[] = [
      makeDomain({ id: '0x1' }),
      makeDomain({
        id: '0x2',
        isWrapped: true,
        fuses: FUSES.CANNOT_UNWRAP | FUSES.CANNOT_TRANSFER,
      }),
      makeDomain({
        id: '0x3',
        isWrapped: true,
        parentName: 'raffy.eth',
        fuses: 0n,
      }),
      makeDomain({ id: '0x4', labelName: null }),
    ]
    const { classified, ineligible } = classifyNames(domains, OWNER)
    expect(classified.map((c) => c.domain.id)).toEqual(['0x1'])
    expect(ineligible.map((i) => [i.domain.id, i.reason])).toEqual([
      ['0x2', 'not-transferable'],
      ['0x3', 'unlocked-subname'],
      ['0x4', 'unknown-label'],
    ])
  })
})

describe('groupClassifiedNames', () => {
  const c = (
    tokenType: ClassifiedName['tokenType'],
    parentName: string | null,
    id = '0x00',
  ): ClassifiedName => ({
    tokenType,
    label: 'x',
    parentName,
    fuses: 0n,
    tokenHolder: OWNER,
    v1ResolverAddress: null,
    resolverStrategy: 'to-owned-permres',
    managerAddress: null,
    domain: { id } as unknown as V1Domain,
  })

  it('buckets by token type and groups children by parentName', () => {
    const g = groupClassifiedNames([
      c('unwrapped', 'eth'),
      c('unlocked', 'eth'),
      c('locked-2ld', 'eth'),
      c('locked-child', 'raffy.eth', '0x10'),
      c('detached-child', 'raffy.eth', '0x11'),
      c('locked-child', 'nick.eth', '0x12'),
    ])
    expect(g.unwrapped).toHaveLength(1)
    expect(g.unlocked).toHaveLength(1)
    expect(g.locked2ld).toHaveLength(1)
    expect(g.childNames.get('raffy.eth')).toHaveLength(2)
    expect(g.childNames.get('nick.eth')).toHaveLength(1)
  })

  it('skips child rows with null parent', () => {
    expect(
      groupClassifiedNames([c('locked-child', null)]).childNames.size,
    ).toBe(0)
  })
})
