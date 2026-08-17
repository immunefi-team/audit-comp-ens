import {
  computeResolverAddress,
  getDestinationContracts,
  ROLES_ALL,
} from '@ens-apps/smart-account'
import {
  type Address,
  decodeFunctionData,
  getAddress,
  type Hex,
  namehash,
  parseAbi,
} from 'viem'
import { sepolia } from 'viem/chains'
import { assert, describe, expect, it, vi } from 'vitest'

import { MIGRATION_HELPER_ABI } from '../contracts/abis'
import { V2_CONTRACTS } from '../contracts/addresses'
import { dnsEncodeName } from '../utils/dnsEncodeName'
import { makeClassified } from './_fixtures'
import {
  AtomicMigrationNameGasLimitExceededError,
  buildAtomicMigrationBatches,
  buildAtomicMigrationInnerExecutions,
  lockedNameOwnerRoleBitmap,
  lockedWrapperRootRoleBitmap,
} from './buildAtomicMigrationBatches'
import { type ClassifiedName, FUSES } from './classifyNames'
import {
  computeExpectedWrapperRegistry,
  type DirectMigrationRoute,
} from './directMigrationRoutes'
import type { Profile } from './fetchV1Profiles'

const HCA: Address = '0x00000000000000000000000000000000000000a1'
const WALLET: Address = '0x00000000000000000000000000000000000000b1'
const MANAGER: Address = '0x00000000000000000000000000000000000000c1'
const DEFAULT_RESOLVER: Address = '0x00000000000000000000000000000000000000d1'
const V1_RESOLVER: Address = '0x00000000000000000000000000000000000000e1'
const PROFILE_ADDRESS = '0x0000000000000000000000000000000000000abc' as Hex

const ROLE_REGISTRAR = 1n << 0n
const ROLE_RENEW = 1n << 16n
const ROLE_SET_RESOLVER = 1n << 24n
const ROLE_CAN_NAME = 1n << 120n
const ROLE_UPGRADE = 1n << 124n
const ROLE_CAN_TRANSFER_ADMIN = 1n << 156n

const hcaOwnerExecutionAbi = parseAbi([
  'function executeByOwner((address target, uint256 value, bytes callData)[] executions) payable',
])

const makeName = (
  name: string,
  overrides: Parameters<typeof makeClassified>[0] = {},
): ClassifiedName =>
  makeClassified({
    id: name,
    labelhash: name,
    label: name.split('.')[0],
    name,
    ...overrides,
  })

const directRoutesFor = (
  classified: readonly ClassifiedName[],
): ReadonlyMap<string, DirectMigrationRoute> =>
  new Map(
    classified.map((name) => {
      const isChild =
        name.tokenType === 'locked-child' || name.tokenType === 'detached-child'
      const createsWrapper =
        name.tokenType === 'locked-2ld' || name.tokenType === 'locked-child'
      const receiver = isChild
        ? computeExpectedWrapperRegistry({ name: name.parentName ?? 'eth' })
        : name.tokenType === 'locked-2ld'
          ? V2_CONTRACTS.LockedMigrationController
          : V2_CONTRACTS.UnlockedMigrationController
      return [
        name.domain.name,
        {
          name: name.domain.name,
          receiver,
          parentDependency: isChild ? name.parentName : null,
          expectedWrapperRegistry: createsWrapper
            ? computeExpectedWrapperRegistry({ name: name.domain.name })
            : null,
          receiverReadiness: isChild
            ? 'created-earlier-in-plan'
            : 'migration-controller',
        } satisfies DirectMigrationRoute,
      ] as const
    }),
  )

const buildPlan = (
  overrides: Partial<Parameters<typeof buildAtomicMigrationBatches>[0]> = {},
) => {
  const classified = overrides.classified ?? [makeName('alice.eth')]
  return buildAtomicMigrationBatches({
    chainId: sepolia.id,
    hca: HCA,
    wallet: WALLET,
    profiles: new Map(),
    defaultResolver: DEFAULT_RESOLVER,
    resolverDeployed: false,
    walletCoAdminGranted: false,
    maxOuterGas: 1_000_000n,
    estimateOuterGas: () => 100_000n,
    ...overrides,
    classified,
    directRoutes: overrides.directRoutes ?? directRoutesFor(classified),
  })
}

type OwnerExecution = {
  readonly target: Address
  readonly value: bigint
  readonly callData: Hex
}

const decodeOwnerExecutions = (data: Hex): readonly OwnerExecution[] => {
  const decoded = decodeFunctionData({ abi: hcaOwnerExecutionAbi, data })
  expect(decoded.functionName).toBe('executeByOwner')
  const [executions] = decoded.args as [readonly OwnerExecution[]]
  return executions
}

describe('buildAtomicMigrationBatches', () => {
  it('keeps parent-before-child order and wraps complete per-name executions', async () => {
    const parent = makeName('parent.eth', {
      tokenType: 'locked-2ld',
      parentName: 'eth',
      fuses: FUSES.CANNOT_UNWRAP,
      managerAddress: MANAGER,
      resolverStrategy: 'to-owned-permres',
    })
    const child = makeName('sub.parent.eth', {
      tokenType: 'locked-child',
      parentName: 'parent.eth',
      fuses: FUSES.CANNOT_UNWRAP,
      resolverStrategy: 'to-owned-permres',
    })
    const parentNode = namehash(parent.domain.name) as Hex
    const profile: Profile = {
      texts: [{ key: 'email', value: 'parent@example.com' }],
      addresses: [{ coinType: 60n, value: PROFILE_ADDRESS }],
      contentHash: '0xe301' as Hex,
      abis: [{ contentType: 1n, value: '0x5b5d' as Hex }],
    }

    const plan = await buildPlan({
      classified: [child, parent],
      profiles: new Map([[parentNode, profile]]),
    })
    const batch = plan.batches[0]
    assert(batch)

    expect(batch.names).toEqual(['parent.eth', 'sub.parent.eth'])
    expect(batch.innerExecutions.map((execution) => execution.phase)).toEqual([
      'resolver-deployment',
      'wallet-co-admin-grant',
      'migrate',
      'manager-role-grant',
      'profile-replay',
    ])
    expect(batch.innerExecutions.map((execution) => execution.name)).toEqual([
      'parent.eth',
      'parent.eth',
      'parent.eth',
      'parent.eth',
      'parent.eth',
    ])

    expect(batch.outerCall.to).toBe(HCA)
    expect(batch.outerCall.value).toBe(0n)
    const wrappedExecutions = decodeOwnerExecutions(batch.outerCall.data)
    expect(
      wrappedExecutions.map((execution) => ({
        ...execution,
        target: execution.target.toLowerCase(),
      })),
    ).toEqual(
      batch.innerExecutions.map(({ call }) => ({
        target: call.to.toLowerCase(),
        value: call.value,
        callData: call.data,
      })),
    )

    const migrate = batch.innerExecutions.find(
      (execution) =>
        execution.name === 'parent.eth' && execution.phase === 'migrate',
    )
    assert(migrate)
    const decodedMigrate = decodeFunctionData({
      abi: MIGRATION_HELPER_ABI,
      data: migrate.call.data,
    })
    expect(migrate.call.to).toBe(V2_CONTRACTS.MigrationHelper)
    expect(migrate.names).toEqual(['parent.eth', 'sub.parent.eth'])
    expect(decodedMigrate.functionName).toBe('migrate')
    expect(decodedMigrate.args[2]).toEqual([
      [expect.objectContaining({ label: 'parent', owner: getAddress(WALLET) })],
    ])
    expect(decodedMigrate.args[3]).toEqual([
      {
        parentName: dnsEncodeName('parent.eth'),
        groups: [
          [
            expect.objectContaining({
              label: 'sub',
              owner: getAddress(WALLET),
            }),
          ],
        ],
      },
    ])

    const expectationTypes = batch.verificationExpectations.map(
      (expectation) => expectation.type,
    )
    expect(expectationTypes).toEqual([
      'resolver-implementation',
      'resolver-root-roles',
      'wallet-name-roles',
      'name-owner',
      'name-resolver',
      'name-owner-roles',
      'wrapper-subregistry',
      'wrapper-root-roles',
      'manager-role',
      'profile-text',
      'profile-address',
      'profile-contenthash',
      'profile-abi',
      'name-owner',
      'name-resolver',
      'name-owner-roles',
      'wrapper-subregistry',
      'wrapper-root-roles',
    ])

    const implementationExpectation = batch.verificationExpectations.find(
      (expectation) => expectation.type === 'resolver-implementation',
    )
    assert(implementationExpectation?.type === 'resolver-implementation')
    expect(implementationExpectation).toMatchObject({
      resolver: computeResolverAddress({ chainId: sepolia.id, hca: HCA }),
      factory: getDestinationContracts(sepolia.id).verifiableFactory,
      expectedImplementation: getDestinationContracts(sepolia.id)
        .permissionedResolverImpl,
      deployer: HCA,
    })

    const rootRolesExpectation = batch.verificationExpectations.find(
      (expectation) => expectation.type === 'resolver-root-roles',
    )
    assert(rootRolesExpectation?.type === 'resolver-root-roles')
    expect(rootRolesExpectation.account).toBe(HCA)
    expect(rootRolesExpectation.roleBitmap).toBe(ROLES_ALL)

    const walletRolesExpectation = batch.verificationExpectations.find(
      (expectation) => expectation.type === 'wallet-name-roles',
    )
    assert(walletRolesExpectation?.type === 'wallet-name-roles')
    expect(walletRolesExpectation).toMatchObject({
      account: WALLET,
      rootName: '0x00',
      roleBitmap: ROLES_ALL,
    })

    const parentOwnerExpectation = batch.verificationExpectations.find(
      (expectation) =>
        expectation.type === 'name-owner' && expectation.name === 'parent.eth',
    )
    assert(parentOwnerExpectation?.type === 'name-owner')
    expect(parentOwnerExpectation).toMatchObject({
      label: 'parent',
      tokenType: 'locked-2ld',
      expectedOwner: WALLET,
      registryPath: {
        type: 'eth-registry-2ld',
        registry: V2_CONTRACTS.ETHRegistry,
      },
    })

    const childOwnerExpectation = batch.verificationExpectations.find(
      (expectation) =>
        expectation.type === 'name-owner' &&
        expectation.name === 'sub.parent.eth',
    )
    assert(childOwnerExpectation?.type === 'name-owner')
    expect(childOwnerExpectation.registryPath).toMatchObject({
      type: 'parent-subregistry',
      rootRegistry: V2_CONTRACTS.ETHRegistry,
      parentName: 'parent.eth',
      parentLabels: ['parent'],
    })

    const childOwnerRolesExpectation = batch.verificationExpectations.find(
      (expectation) =>
        expectation.type === 'name-owner-roles' &&
        expectation.name === 'sub.parent.eth',
    )
    assert(childOwnerRolesExpectation?.type === 'name-owner-roles')
    expect(childOwnerRolesExpectation).toMatchObject({
      account: WALLET,
      roleBitmap:
        ROLE_SET_RESOLVER |
        (ROLE_SET_RESOLVER << 128n) |
        ROLE_CAN_TRANSFER_ADMIN,
    })

    const wrapperExpectation = batch.verificationExpectations.find(
      (expectation) =>
        expectation.type === 'wrapper-subregistry' &&
        expectation.name === 'sub.parent.eth',
    )
    assert(wrapperExpectation?.type === 'wrapper-subregistry')
    expect(wrapperExpectation).toMatchObject({
      label: 'sub',
      node: namehash('sub.parent.eth'),
      factory: V2_CONTRACTS.VerifiableFactory,
      expectedImplementation: V2_CONTRACTS.WrapperRegistryImpl,
    })

    const wrapperRolesExpectation = batch.verificationExpectations.find(
      (expectation) =>
        expectation.type === 'wrapper-root-roles' &&
        expectation.name === 'sub.parent.eth',
    )
    assert(wrapperRolesExpectation?.type === 'wrapper-root-roles')
    const baseWrapperRoles =
      ROLE_REGISTRAR | ROLE_RENEW | ROLE_CAN_NAME | ROLE_UPGRADE
    expect(wrapperRolesExpectation).toMatchObject({
      resource: 0n,
      account: WALLET,
      roleBitmap: baseWrapperRoles | (baseWrapperRoles << 128n),
    })

    const profileExpectations = batch.verificationExpectations.filter(
      (expectation) =>
        expectation.type === 'profile-text' ||
        expectation.type === 'profile-address' ||
        expectation.type === 'profile-contenthash' ||
        expectation.type === 'profile-abi',
    )
    expect(profileExpectations).toEqual([
      expect.objectContaining({
        type: 'profile-text',
        node: parentNode,
        key: 'email',
        value: 'parent@example.com',
      }),
      expect.objectContaining({
        type: 'profile-address',
        node: parentNode,
        coinType: 60n,
        value: PROFILE_ADDRESS,
      }),
      expect.objectContaining({
        type: 'profile-contenthash',
        node: parentNode,
        value: '0xe301',
      }),
      expect.objectContaining({
        type: 'profile-abi',
        node: parentNode,
        contentType: 1n,
        value: '0x5b5d',
      }),
    ])
  })

  it('derives locked owner and WrapperRegistry root roles from NameWrapper fuses', () => {
    expect(lockedNameOwnerRoleBitmap(FUSES.CANNOT_UNWRAP)).toBe(
      ROLE_SET_RESOLVER | (ROLE_SET_RESOLVER << 128n) | ROLE_CAN_TRANSFER_ADMIN,
    )
    expect(
      lockedNameOwnerRoleBitmap(
        FUSES.CANNOT_UNWRAP |
          FUSES.CANNOT_BURN_FUSES |
          FUSES.CANNOT_SET_RESOLVER |
          FUSES.CANNOT_TRANSFER |
          FUSES.CAN_EXTEND_EXPIRY,
      ),
    ).toBe(ROLE_RENEW)

    const baseWrapperRoles =
      ROLE_REGISTRAR | ROLE_RENEW | ROLE_CAN_NAME | ROLE_UPGRADE
    expect(lockedWrapperRootRoleBitmap(FUSES.CANNOT_UNWRAP)).toBe(
      baseWrapperRoles | (baseWrapperRoles << 128n),
    )
    expect(
      lockedWrapperRootRoleBitmap(
        FUSES.CANNOT_UNWRAP |
          FUSES.CANNOT_CREATE_SUBDOMAIN |
          FUSES.CANNOT_BURN_FUSES,
      ),
    ).toBe(ROLE_RENEW | ROLE_CAN_NAME | ROLE_UPGRADE)
  })

  it('requires a certified WrapperRegistry for a locked 2LD', async () => {
    const plan = await buildPlan({
      classified: [
        makeName('locked.eth', {
          tokenType: 'locked-2ld',
          fuses: FUSES.CANNOT_UNWRAP,
        }),
      ],
    })
    const batch = plan.batches[0]
    assert(batch)

    const wrapperExpectation = batch.verificationExpectations.find(
      (expectation) => expectation.type === 'wrapper-subregistry',
    )
    assert(wrapperExpectation?.type === 'wrapper-subregistry')
    expect(wrapperExpectation).toMatchObject({
      name: 'locked.eth',
      label: 'locked',
      registryPath: {
        type: 'eth-registry-2ld',
        registry: V2_CONTRACTS.ETHRegistry,
      },
      expectedImplementation: V2_CONTRACTS.WrapperRegistryImpl,
    })
  })

  it('omits one-time setup calls when resolver invariants are already satisfied', async () => {
    const plan = await buildPlan({
      classified: [makeName('alice.eth'), makeName('bob.eth')],
      resolverDeployed: true,
      walletCoAdminGranted: true,
    })
    const batch = plan.batches[0]
    assert(batch)

    expect(batch.innerExecutions.map((execution) => execution.phase)).toEqual([
      'migrate',
    ])
    expect(
      batch.verificationExpectations.map((expectation) => expectation.type),
    ).toEqual([
      'resolver-implementation',
      'resolver-root-roles',
      'wallet-name-roles',
      'name-owner',
      'name-resolver',
      'name-owner',
      'name-resolver',
    ])
  })

  it('splits only between complete name units using wrapped-call estimates', async () => {
    const estimateOuterGas = vi.fn(
      ({
        call,
        names,
      }: Parameters<
        NonNullable<
          Parameters<typeof buildAtomicMigrationBatches>[0]['estimateOuterGas']
        >
      >[0]) => {
        expect(call.to).toBe(HCA)
        expect(decodeOwnerExecutions(call.data)).not.toHaveLength(0)
        return BigInt(names.length) * 100n
      },
    )
    const classified = ['alice.eth', 'bob.eth', 'carol.eth'].map((name) =>
      makeName(name, {
        resolverStrategy: 'keep-v1',
        v1ResolverAddress: V1_RESOLVER,
      }),
    )

    const plan = await buildPlan({
      classified,
      maxOuterGas: 250n,
      estimateOuterGas,
    })

    expect(plan.batches.map((batch) => batch.names)).toEqual([
      ['alice.eth', 'bob.eth'],
      ['carol.eth'],
    ])
    expect(plan.batches.map((batch) => batch.estimatedGas)).toEqual([
      200n,
      100n,
    ])
    expect(
      plan.batches.flatMap((batch) =>
        batch.nameExecutions.map(
          (execution) => execution.classified.domain.name,
        ),
      ),
    ).toEqual(['alice.eth', 'bob.eth', 'carol.eth'])
  })

  it('seeds execution from the preview boundary instead of estimating every prefix', async () => {
    const classified = Array.from({ length: 150 }, (_, index) =>
      makeName(`name-${index}.eth`, {
        resolverStrategy: 'keep-v1',
        v1ResolverAddress: V1_RESOLVER,
      }),
    )
    const estimatedSizes: number[] = []

    const plan = await buildPlan({
      classified,
      maxOuterGas: 9_000n,
      firstBatchOnly: true,
      initialBatchSize: 90,
      estimateOuterGas: ({ names }) => {
        estimatedSizes.push(names.length)
        return BigInt(names.length) * 100n
      },
    })

    expect(plan.batches).toHaveLength(1)
    expect(plan.batches[0]?.names).toHaveLength(90)
    expect(plan.batches[0]?.estimatedGas).toBe(9_000n)
    expect(estimatedSizes).toEqual([90])
  })

  it('propagates a preview estimate failure without replaying every prefix', async () => {
    const classified = Array.from({ length: 120 }, (_, index) =>
      makeName(`name-${index}.eth`, {
        resolverStrategy: 'keep-v1',
        v1ResolverAddress: V1_RESOLVER,
      }),
    )
    const estimateOuterGas = vi.fn(
      ({ names }: { names: readonly string[] }) => {
        if (names.length > 38) {
          throw new Error(
            'ERC1155: transfer to non ERC1155Receiver implementer',
          )
        }
        return BigInt(names.length) * 100n
      },
    )

    await expect(
      buildPlan({
        classified,
        maxOuterGas: 20_000n,
        firstBatchOnly: true,
        initialBatchSize: 90,
        estimateOuterGas,
      }),
    ).rejects.toThrow('ERC1155: transfer to non ERC1155Receiver implementer')

    expect(
      estimateOuterGas.mock.calls.map(([{ names }]) => names.length),
    ).toEqual([90])
  })

  it('does not split unrelated estimate failures', async () => {
    const estimateOuterGas = vi.fn((_input: { names: readonly string[] }) => {
      throw new Error('permission missing')
    })

    await expect(
      buildPlan({
        classified: [makeName('alice.eth'), makeName('bob.eth')],
        firstBatchOnly: true,
        initialBatchSize: 2,
        estimateOuterGas,
      }),
    ).rejects.toThrow('permission missing')
    expect(
      estimateOuterGas.mock.calls.map(([{ names }]) => names.length),
    ).toEqual([2])
  })

  it('uses a bounded downward search when the preview exceeds the live limit', async () => {
    const classified = Array.from({ length: 120 }, (_, index) =>
      makeName(`name-${index}.eth`, {
        resolverStrategy: 'keep-v1',
        v1ResolverAddress: V1_RESOLVER,
      }),
    )
    const estimatedSizes: number[] = []

    const plan = await buildPlan({
      classified,
      maxOuterGas: 6_500n,
      firstBatchOnly: true,
      initialBatchSize: 90,
      estimateOuterGas: ({ names }) => {
        estimatedSizes.push(names.length)
        return BigInt(names.length) * 100n
      },
    })

    expect(plan.batches[0]?.names).toHaveLength(65)
    expect(plan.batches[0]?.estimatedGas).toBe(6_500n)
    expect(estimatedSizes.length).toBeLessThanOrEqual(9)
    expect(estimatedSizes[0]).toBe(90)
  })

  it('surfaces an estimate failure when one name cannot simulate', async () => {
    const estimateOuterGas = vi.fn(() => {
      throw new Error('ERC1155: transfer to non ERC1155Receiver implementer')
    })

    await expect(
      buildPlan({
        classified: [makeName('alice.eth')],
        firstBatchOnly: true,
        initialBatchSize: 1,
        estimateOuterGas,
      }),
    ).rejects.toThrow('ERC1155: transfer to non ERC1155Receiver implementer')
    expect(estimateOuterGas).toHaveBeenCalledOnce()
  })

  it('rebuilds the helper groups after retry removes a name', async () => {
    const plan = await buildPlan({
      classified: [
        makeName('alice.eth', { tokenType: 'unlocked' }),
        makeName('bob.eth', { tokenType: 'unlocked' }),
      ],
      resolverDeployed: true,
      walletCoAdminGranted: true,
    })
    const batch = plan.batches[0]
    assert(batch)

    const [groupedMigration] = batch.innerExecutions
    assert(groupedMigration)
    expect(groupedMigration.names).toEqual(['alice.eth', 'bob.eth'])
    expect(
      decodeFunctionData({
        abi: MIGRATION_HELPER_ABI,
        data: groupedMigration.call.data,
      }).functionName,
    ).toBe('migrate')

    const bobExecution = batch.nameExecutions.find(
      (execution) => execution.classified.domain.name === 'bob.eth',
    )
    assert(bobExecution)
    const [retryMigration] = buildAtomicMigrationInnerExecutions({
      nameExecutions: [bobExecution],
    })
    assert(retryMigration)
    expect(retryMigration.names).toEqual(['bob.eth'])
    expect(
      decodeFunctionData({
        abi: MIGRATION_HELPER_ABI,
        data: retryMigration.call.data,
      }).functionName,
    ).toBe('migrate')
  })

  it('blocks a single name whose wrapped execution exceeds the limit', async () => {
    const promise = buildPlan({
      classified: [makeName('oversized.eth')],
      maxOuterGas: 499n,
      estimateOuterGas: () => 500n,
    })

    await expect(promise).rejects.toMatchObject({
      name: 'AtomicMigrationNameGasLimitExceededError',
      ensName: 'oversized.eth',
      estimatedGas: 500n,
      maxOuterGas: 499n,
    })
    await expect(promise).rejects.toBeInstanceOf(
      AtomicMigrationNameGasLimitExceededError,
    )
  })
})
