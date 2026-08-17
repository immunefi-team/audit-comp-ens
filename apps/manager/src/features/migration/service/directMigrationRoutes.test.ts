import { type Address, namehash, type PublicClient } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { V2_CONTRACTS } from '../contracts/addresses'
import { makeClassified } from './_fixtures'
import {
  computeExpectedWrapperRegistry,
  DirectMigrationRouteError,
  orderDirectMigrationNamesParentFirst,
  resolveDirectMigrationRoutes,
} from './directMigrationRoutes'

const OTHER_WRAPPER: Address = '0x00000000000000000000000000000000000000ff'

const publicClientForWrapper = (params: {
  readonly name: string
  readonly actualWrapper?: Address
  readonly implementation?: Address
  readonly hasCode?: boolean
}): PublicClient => {
  const expectedWrapper = computeExpectedWrapperRegistry({ name: params.name })
  return {
    getCode: vi
      .fn()
      .mockResolvedValue(params.hasCode === false ? '0x' : '0x01'),
    readContract: vi.fn().mockImplementation(({ functionName }) => {
      switch (functionName) {
        case 'getSubregistry':
          return Promise.resolve(params.actualWrapper ?? expectedWrapper)
        case 'verifyContract':
          return Promise.resolve(
            params.implementation ?? V2_CONTRACTS.WrapperRegistryImpl,
          )
        case 'getWrappedNode':
          return Promise.resolve(namehash(params.name))
        default:
          throw new Error(`Unexpected read ${functionName}`)
      }
    }),
  } as unknown as PublicClient
}

describe('computeExpectedWrapperRegistry', () => {
  it('recursively changes the deployer for nested wrappers', () => {
    const parent = computeExpectedWrapperRegistry({ name: 'parent.eth' })
    const child = computeExpectedWrapperRegistry({ name: 'sub.parent.eth' })

    expect(parent).not.toBe(child)
    expect(parent).toMatch(/^0x[0-9a-fA-F]{40}$/)
    expect(child).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('rejects routes outside the .eth wrapper tree', () => {
    expect(() =>
      computeExpectedWrapperRegistry({ name: 'parent.example' }),
    ).toThrowError(DirectMigrationRouteError)
  })
})

describe('orderDirectMigrationNamesParentFirst', () => {
  it('orders selected locked parents before children', () => {
    const child = makeClassified({
      name: 'sub.parent.eth',
      label: 'sub',
      tokenType: 'locked-child',
      parentName: 'parent.eth',
    })
    const parent = makeClassified({
      name: 'parent.eth',
      label: 'parent',
      tokenType: 'locked-2ld',
      parentName: 'eth',
    })

    expect(
      orderDirectMigrationNamesParentFirst([child, parent]).map(
        (name) => name.domain.name,
      ),
    ).toEqual(['parent.eth', 'sub.parent.eth'])
  })

  it('blocks selected parents that cannot create a wrapper', () => {
    const child = makeClassified({
      name: 'sub.parent.eth',
      label: 'sub',
      tokenType: 'locked-child',
      parentName: 'parent.eth',
    })
    const parent = makeClassified({
      name: 'parent.eth',
      label: 'parent',
      tokenType: 'unlocked',
      parentName: 'eth',
    })

    expect(() => orderDirectMigrationNamesParentFirst([child, parent])).toThrow(
      expect.objectContaining({ reason: 'parent-cannot-create-wrapper' }),
    )
  })

  it('fails closed on cyclic selected routes', () => {
    const first = makeClassified({
      name: 'first.eth',
      tokenType: 'locked-child',
      parentName: 'second.eth',
    })
    const second = makeClassified({
      name: 'second.eth',
      tokenType: 'locked-child',
      parentName: 'first.eth',
    })

    expect(() => orderDirectMigrationNamesParentFirst([first, second])).toThrow(
      expect.objectContaining({ reason: 'cyclic-route' }),
    )
  })
})

describe('resolveDirectMigrationRoutes', () => {
  it('uses controllers directly and a selected deterministic parent wrapper', async () => {
    const unwrapped = makeClassified({ name: 'alice.eth', label: 'alice' })
    const lockedParent = makeClassified({
      name: 'parent.eth',
      label: 'parent',
      tokenType: 'locked-2ld',
      parentName: 'eth',
    })
    const lockedChild = makeClassified({
      name: 'sub.parent.eth',
      label: 'sub',
      tokenType: 'locked-child',
      parentName: 'parent.eth',
    })
    const publicClient = {
      getCode: vi.fn(),
      readContract: vi.fn(),
    } as unknown as PublicClient

    const routes = await resolveDirectMigrationRoutes({
      publicClient,
      classified: [lockedChild, unwrapped, lockedParent],
    })

    expect(routes.get('alice.eth')).toMatchObject({
      receiver: V2_CONTRACTS.UnlockedMigrationController,
      receiverReadiness: 'migration-controller',
    })
    expect(routes.get('parent.eth')).toMatchObject({
      receiver: V2_CONTRACTS.LockedMigrationController,
      expectedWrapperRegistry: computeExpectedWrapperRegistry({
        name: 'parent.eth',
      }),
    })
    expect(routes.get('sub.parent.eth')).toMatchObject({
      receiver: computeExpectedWrapperRegistry({ name: 'parent.eth' }),
      parentDependency: 'parent.eth',
      receiverReadiness: 'created-earlier-in-plan',
    })
    expect(publicClient.readContract).not.toHaveBeenCalled()
  })

  it('recursively certifies a parent not selected for migration', async () => {
    const child = makeClassified({
      name: 'sub.parent.eth',
      label: 'sub',
      tokenType: 'detached-child',
      parentName: 'parent.eth',
    })
    const publicClient = publicClientForWrapper({ name: 'parent.eth' })

    const routes = await resolveDirectMigrationRoutes({
      publicClient,
      classified: [child],
    })

    expect(routes.get(child.domain.name)).toMatchObject({
      receiver: computeExpectedWrapperRegistry({ name: 'parent.eth' }),
      receiverReadiness: 'existing-verified-wrapper',
      expectedWrapperRegistry: null,
    })
  })

  it('blocks a conflicting parent registry route', async () => {
    const child = makeClassified({
      name: 'sub.parent.eth',
      label: 'sub',
      tokenType: 'locked-child',
      parentName: 'parent.eth',
    })

    await expect(
      resolveDirectMigrationRoutes({
        publicClient: publicClientForWrapper({
          name: 'parent.eth',
          actualWrapper: OTHER_WRAPPER,
        }),
        classified: [child],
      }),
    ).rejects.toMatchObject({ reason: 'conflicting-wrapper' })
  })

  it('blocks an uncertified deterministic parent wrapper', async () => {
    const child = makeClassified({
      name: 'sub.parent.eth',
      label: 'sub',
      tokenType: 'locked-child',
      parentName: 'parent.eth',
    })

    await expect(
      resolveDirectMigrationRoutes({
        publicClient: publicClientForWrapper({
          name: 'parent.eth',
          implementation: OTHER_WRAPPER,
        }),
        classified: [child],
      }),
    ).rejects.toMatchObject({ reason: 'uncertified-wrapper' })
  })
})
