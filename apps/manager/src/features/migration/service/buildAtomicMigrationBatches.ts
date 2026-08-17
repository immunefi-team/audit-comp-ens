import {
  buildHcaOwnerExecutionCall,
  computeResolverAddress,
  computeResolverSalt,
  getDestinationContracts,
  ROLES_ALL,
} from '@ens-apps/smart-account'
import type { Call } from '@ens-apps/transaction-manager'
import { labelToCanonicalId } from '@ensdomains/ensjs/utils/v2'
import { permissionedResolverAuthorizeNameRolesSnippet } from '@ensdomains/ensjs-abi/v2/permissionedResolver'
import { verifiableFactoryDeployProxySnippet } from '@ensdomains/ensjs-abi/v2/verifiableFactory'
import {
  type Address,
  encodeFunctionData,
  type Hex,
  namehash,
  zeroAddress,
} from 'viem'

import { PERMISSIONED_RESOLVER_ABI } from '../contracts/abis'
import { V2_CONTRACTS } from '../contracts/addresses'
import {
  buildMigrationHelperCall,
  type MigrationHelperNameInput,
} from './buildMigrationHelperCall'
import {
  flattenProfileInnerCalls,
  wrapInnerCallsAsMulticall,
} from './buildProfileReplayCalls'
import { buildRoleGrantCall } from './buildRoleGrantCalls'
import { type ClassifiedName, FUSES, hasFuse } from './classifyNames'
import {
  type DirectMigrationRoute,
  orderDirectMigrationNamesParentFirst,
} from './directMigrationRoutes'
import {
  createMigrationData,
  type MigrationData,
  resolverFor,
} from './encodeMigration'
import type { Profile } from './fetchV1Profiles'
import { profileMapKey } from './fetchV1Profiles'

const ROOT_NAME = '0x00' as const
const ROOT_RESOURCE = 0n
const ROLE_REGISTRAR = 1n << 0n
const ROLE_RENEW = 1n << 16n
const ROLE_SET_RESOLVER = 1n << 24n
const ROLE_CAN_NAME = 1n << 120n
const ROLE_UPGRADE = 1n << 124n
const ROLE_CAN_TRANSFER_ADMIN = 1n << 156n

export type AtomicMigrationExecutionPhase =
  | 'resolver-deployment'
  | 'wallet-co-admin-grant'
  | 'migrate'
  | 'manager-role-grant'
  | 'profile-replay'

export type AtomicMigrationInnerExecution = {
  readonly phase: AtomicMigrationExecutionPhase
  /** First name, retained for single-name UI/profile accounting. */
  readonly name: string
  /** Every name included by this call (multiple for ERC-1155 batches). */
  readonly names: readonly string[]
  readonly call: Call
}

export type AtomicMigrationRegistryPath =
  | {
      readonly type: 'eth-registry-2ld'
      readonly registry: Address
      readonly label: string
      readonly resource: bigint
    }
  | {
      readonly type: 'parent-subregistry'
      readonly rootRegistry: Address
      readonly parentName: string
      /** Labels traversed from ETHRegistry to the immediate parent registry. */
      readonly parentLabels: readonly string[]
      readonly label: string
      readonly resource: bigint
    }

type ResolverImplementationExpectation = {
  readonly id: string
  readonly type: 'resolver-implementation'
  readonly name: string
  readonly resolver: Address
  readonly factory: Address
  readonly expectedImplementation: Address
  readonly deployer: Address
  readonly salt: bigint
}

type ResolverRootRolesExpectation = {
  readonly id: string
  readonly type: 'resolver-root-roles'
  readonly name: string
  readonly resolver: Address
  readonly account: Address
  readonly rootName: Hex
  readonly roleBitmap: bigint
}

type WalletNameRolesExpectation = {
  readonly id: string
  readonly type: 'wallet-name-roles'
  readonly name: string
  readonly resolver: Address
  readonly account: Address
  readonly rootName: Hex
  readonly roleBitmap: bigint
}

type NameOwnerExpectation = {
  readonly id: string
  readonly type: 'name-owner'
  readonly name: string
  readonly label: string
  readonly node: Hex
  readonly resource: bigint
  readonly tokenType: ClassifiedName['tokenType']
  readonly registryPath: AtomicMigrationRegistryPath
  readonly expectedOwner: Address
}

type NameResolverExpectation = {
  readonly id: string
  readonly type: 'name-resolver'
  readonly name: string
  readonly label: string
  readonly node: Hex
  readonly resource: bigint
  readonly registryPath: AtomicMigrationRegistryPath
  readonly expectedResolver: Address
}

type NameOwnerRolesExpectation = {
  readonly id: string
  readonly type: 'name-owner-roles'
  readonly name: string
  readonly registryPath: AtomicMigrationRegistryPath
  readonly resource: bigint
  readonly account: Address
  readonly roleBitmap: bigint
}

type WrapperSubregistryExpectation = {
  readonly id: string
  readonly type: 'wrapper-subregistry'
  readonly name: string
  readonly node: Hex
  readonly label: string
  readonly registryPath: AtomicMigrationRegistryPath
  readonly factory: Address
  readonly expectedImplementation: Address
  readonly expectedWrapperRegistry: Address
}

type WrapperRootRolesExpectation = {
  readonly id: string
  readonly type: 'wrapper-root-roles'
  readonly name: string
  readonly label: string
  readonly registryPath: AtomicMigrationRegistryPath
  readonly resource: typeof ROOT_RESOURCE
  readonly account: Address
  readonly roleBitmap: bigint
}

type ManagerRoleExpectation = {
  readonly id: string
  readonly type: 'manager-role'
  readonly name: string
  readonly label: string
  readonly registry: Address
  readonly resource: bigint
  readonly account: Address
  readonly roleBitmap: bigint
}

type ProfileTextExpectation = {
  readonly id: string
  readonly type: 'profile-text'
  readonly name: string
  readonly node: Hex
  readonly resolver: Address
  readonly key: string
  readonly value: string
}

type ProfileAddressExpectation = {
  readonly id: string
  readonly type: 'profile-address'
  readonly name: string
  readonly node: Hex
  readonly resolver: Address
  readonly coinType: bigint
  readonly value: Hex
}

type ProfileContenthashExpectation = {
  readonly id: string
  readonly type: 'profile-contenthash'
  readonly name: string
  readonly node: Hex
  readonly resolver: Address
  readonly value: Hex
}

type ProfileAbiExpectation = {
  readonly id: string
  readonly type: 'profile-abi'
  readonly name: string
  readonly node: Hex
  readonly resolver: Address
  readonly contentType: bigint
  readonly value: Hex
}

export type AtomicMigrationVerificationExpectation =
  | ResolverImplementationExpectation
  | ResolverRootRolesExpectation
  | WalletNameRolesExpectation
  | NameOwnerExpectation
  | NameResolverExpectation
  | NameOwnerRolesExpectation
  | WrapperSubregistryExpectation
  | WrapperRootRolesExpectation
  | ManagerRoleExpectation
  | ProfileTextExpectation
  | ProfileAddressExpectation
  | ProfileContenthashExpectation
  | ProfileAbiExpectation

export type AtomicMigrationNameExecution = {
  readonly classified: ClassifiedName
  readonly directRoute: DirectMigrationRoute
  readonly migrationData: MigrationData
  readonly innerExecutions: readonly AtomicMigrationInnerExecution[]
  readonly verificationExpectations: readonly AtomicMigrationVerificationExpectation[]
}

export type AtomicMigrationBatch = {
  readonly index: number
  readonly names: readonly string[]
  readonly nameExecutions: readonly AtomicMigrationNameExecution[]
  readonly innerExecutions: readonly AtomicMigrationInnerExecution[]
  readonly outerCall: Call
  readonly estimatedGas: bigint
  readonly verificationExpectations: readonly AtomicMigrationVerificationExpectation[]
}

export type AtomicMigrationBatchPlan = {
  readonly resolver: Address
  readonly batches: readonly AtomicMigrationBatch[]
}

export type AtomicMigrationOuterGasEstimateRequest = {
  readonly call: Call
  readonly names: readonly string[]
  readonly innerExecutions: readonly AtomicMigrationInnerExecution[]
}

export type EstimateAtomicMigrationOuterGas = (
  request: AtomicMigrationOuterGasEstimateRequest,
) => bigint | Promise<bigint>

export type AtomicMigrationExpectationResult = {
  readonly expectationId: string
  readonly satisfied: boolean
}

export type AtomicMigrationBatchVerification =
  | {
      readonly batchIndex: number
      readonly status: 'reverted'
    }
  | {
      readonly batchIndex: number
      readonly status: 'confirmed'
      readonly results: readonly AtomicMigrationExpectationResult[]
    }

export class AtomicMigrationNameGasLimitExceededError extends Error {
  readonly ensName: string
  readonly estimatedGas: bigint
  readonly maxOuterGas: bigint

  constructor(params: {
    readonly ensName: string
    readonly estimatedGas: bigint
    readonly maxOuterGas: bigint
  }) {
    super(
      `Atomic migration for "${params.ensName}" estimated at ${params.estimatedGas} gas; exceeds outer executeByOwner limit ${params.maxOuterGas}`,
    )
    this.name = 'AtomicMigrationNameGasLimitExceededError'
    this.ensName = params.ensName
    this.estimatedGas = params.estimatedGas
    this.maxOuterGas = params.maxOuterGas
  }
}

export type BuildAtomicMigrationBatchesParams = {
  readonly chainId: number
  readonly hca: Address
  readonly wallet: Address
  readonly classified: readonly ClassifiedName[]
  readonly directRoutes: ReadonlyMap<string, DirectMigrationRoute>
  readonly profiles: ReadonlyMap<Hex, Profile>
  readonly defaultResolver?: Address
  readonly resolverDeployed: boolean
  readonly walletCoAdminGranted: boolean
  readonly maxOuterGas: bigint
  readonly estimateOuterGas: EstimateAtomicMigrationOuterGas
  /** Execution only: return once the leading executable batch is known. */
  readonly firstBatchOnly?: boolean
  /** Preview-derived leading batch size used to seed live gas discovery. */
  readonly initialBatchSize?: number
}

const expectationId = (
  name: string,
  expectation: AtomicMigrationVerificationExpectation['type'],
  detail?: string,
): string => `${name}:${expectation}${detail ? `:${detail}` : ''}`

const registryPathFor = (name: ClassifiedName): AtomicMigrationRegistryPath => {
  const resource = labelToCanonicalId(name.label)
  const is2ld =
    name.tokenType === 'unwrapped' ||
    name.tokenType === 'unlocked' ||
    name.tokenType === 'locked-2ld'

  if (is2ld) {
    return {
      type: 'eth-registry-2ld',
      registry: V2_CONTRACTS.ETHRegistry,
      label: name.label,
      resource,
    }
  }

  if (!name.parentName) {
    throw new Error(
      `Cannot build verification registry path for "${name.domain.name}" without a parent`,
    )
  }

  return {
    type: 'parent-subregistry',
    rootRegistry: V2_CONTRACTS.ETHRegistry,
    parentName: name.parentName,
    parentLabels: name.parentName.split('.').slice(0, -1).reverse(),
    label: name.label,
    resource,
  }
}

const isLockedName = (name: ClassifiedName): boolean =>
  name.tokenType === 'locked-2ld' || name.tokenType === 'locked-child'

/** Mirrors LockedWrapperReceiver._tokenRoleBitmapFromFuses(). */
export const lockedNameOwnerRoleBitmap = (fuses: bigint): bigint => {
  let roleBitmap = 0n
  if (hasFuse(fuses, FUSES.CAN_EXTEND_EXPIRY)) {
    roleBitmap |= ROLE_RENEW
  }
  if (!hasFuse(fuses, FUSES.CANNOT_SET_RESOLVER)) {
    roleBitmap |= ROLE_SET_RESOLVER
  }
  if (!hasFuse(fuses, FUSES.CANNOT_BURN_FUSES)) {
    roleBitmap |= roleBitmap << 128n
  }
  if (!hasFuse(fuses, FUSES.CANNOT_TRANSFER)) {
    roleBitmap |= ROLE_CAN_TRANSFER_ADMIN
  }
  return roleBitmap
}

/** Mirrors LockedWrapperReceiver._subregistryRoleBitmapFromFuses(). */
export const lockedWrapperRootRoleBitmap = (fuses: bigint): bigint => {
  let roleBitmap = ROLE_RENEW | ROLE_UPGRADE | ROLE_CAN_NAME
  if (!hasFuse(fuses, FUSES.CANNOT_CREATE_SUBDOMAIN)) {
    roleBitmap |= ROLE_REGISTRAR
  }
  if (!hasFuse(fuses, FUSES.CANNOT_BURN_FUSES)) {
    roleBitmap |= roleBitmap << 128n
  }
  return roleBitmap
}

const buildResolverDeploymentCall = (params: {
  readonly chainId: number
  readonly hca: Address
}): Call => {
  const contracts = getDestinationContracts(params.chainId)
  const initializeData = encodeFunctionData({
    abi: PERMISSIONED_RESOLVER_ABI,
    functionName: 'initialize',
    args: [params.hca, ROLES_ALL, []],
  })

  return {
    to: contracts.verifiableFactory,
    data: encodeFunctionData({
      abi: verifiableFactoryDeployProxySnippet,
      functionName: 'deployProxy',
      args: [
        contracts.permissionedResolverImpl,
        computeResolverSalt(params.hca),
        initializeData,
      ],
    }),
    value: 0n,
  }
}

const buildWalletCoAdminCall = (params: {
  readonly resolver: Address
  readonly wallet: Address
}): Call => ({
  to: params.resolver,
  data: encodeFunctionData({
    abi: permissionedResolverAuthorizeNameRolesSnippet,
    functionName: 'authorizeNameRoles',
    args: [ROOT_NAME, ROLES_ALL, params.wallet, true],
  }),
  value: 0n,
})

const profileForName = (
  name: ClassifiedName,
  profiles: ReadonlyMap<Hex, Profile>,
): { readonly node: Hex; readonly profile: Profile } | null => {
  if (name.resolverStrategy !== 'to-owned-permres') return null

  const node = namehash(name.domain.name) as Hex
  const profile = profiles.get(profileMapKey(node))
  if (!profile) return null

  const hasRecords =
    profile.texts.length > 0 ||
    profile.addresses.length > 0 ||
    profile.contentHash !== null ||
    profile.abis.length > 0
  return hasRecords ? { node, profile } : null
}

const buildNameExecution = (params: {
  readonly chainId: number
  readonly hca: Address
  readonly wallet: Address
  readonly classified: ClassifiedName
  readonly directRoute: DirectMigrationRoute
  readonly resolver: Address
  readonly defaultResolver: Address
  readonly profiles: ReadonlyMap<Hex, Profile>
  readonly includeResolverVerification: boolean
  readonly includeResolverDeployment: boolean
  readonly includeWalletCoAdminGrant: boolean
}): AtomicMigrationNameExecution => {
  const {
    chainId,
    hca,
    wallet,
    classified,
    directRoute,
    resolver,
    defaultResolver,
    profiles,
    includeResolverVerification,
    includeResolverDeployment,
    includeWalletCoAdminGrant,
  } = params
  const name = classified.domain.name
  const node = namehash(name) as Hex
  const expectedResolver = resolverFor(classified, defaultResolver, resolver)
  const innerExecutions: AtomicMigrationInnerExecution[] = []
  const verificationExpectations: AtomicMigrationVerificationExpectation[] = []
  const contracts = getDestinationContracts(chainId)
  const registryPath = registryPathFor(classified)
  const migrationData = createMigrationData({
    label: classified.label,
    owner: wallet,
    subregistry: zeroAddress,
    resolver: expectedResolver,
  })

  if (includeResolverVerification) {
    verificationExpectations.push(
      {
        id: expectationId(name, 'resolver-implementation'),
        type: 'resolver-implementation',
        name,
        resolver,
        factory: contracts.verifiableFactory,
        expectedImplementation: contracts.permissionedResolverImpl,
        deployer: hca,
        salt: computeResolverSalt(hca),
      },
      {
        id: expectationId(name, 'resolver-root-roles'),
        type: 'resolver-root-roles',
        name,
        resolver,
        account: hca,
        rootName: ROOT_NAME,
        roleBitmap: ROLES_ALL,
      },
      {
        id: expectationId(name, 'wallet-name-roles'),
        type: 'wallet-name-roles',
        name,
        resolver,
        account: wallet,
        rootName: ROOT_NAME,
        roleBitmap: ROLES_ALL,
      },
    )
  }

  if (includeResolverDeployment) {
    innerExecutions.push({
      phase: 'resolver-deployment',
      name,
      names: [name],
      call: buildResolverDeploymentCall({ chainId, hca }),
    })
  }

  if (includeWalletCoAdminGrant) {
    innerExecutions.push({
      phase: 'wallet-co-admin-grant',
      name,
      names: [name],
      call: buildWalletCoAdminCall({ resolver, wallet }),
    })
  }

  verificationExpectations.push(
    {
      id: expectationId(name, 'name-owner'),
      type: 'name-owner',
      name,
      label: classified.label,
      node,
      resource: labelToCanonicalId(classified.label),
      tokenType: classified.tokenType,
      registryPath,
      expectedOwner: wallet,
    },
    {
      id: expectationId(name, 'name-resolver'),
      type: 'name-resolver',
      name,
      label: classified.label,
      node,
      resource: labelToCanonicalId(classified.label),
      registryPath,
      expectedResolver,
    },
  )

  if (isLockedName(classified)) {
    if (!directRoute.expectedWrapperRegistry) {
      throw new Error(
        `Locked migration route for "${name}" has no deterministic WrapperRegistry`,
      )
    }
    verificationExpectations.push(
      {
        id: expectationId(name, 'name-owner-roles'),
        type: 'name-owner-roles',
        name,
        registryPath,
        resource: labelToCanonicalId(classified.label),
        account: wallet,
        roleBitmap: lockedNameOwnerRoleBitmap(classified.fuses),
      },
      {
        id: expectationId(name, 'wrapper-subregistry'),
        type: 'wrapper-subregistry',
        name,
        node,
        label: classified.label,
        registryPath,
        factory: contracts.verifiableFactory,
        expectedImplementation: contracts.wrapperRegistryImpl,
        expectedWrapperRegistry: directRoute.expectedWrapperRegistry,
      },
      {
        id: expectationId(name, 'wrapper-root-roles'),
        type: 'wrapper-root-roles',
        name,
        label: classified.label,
        registryPath,
        resource: ROOT_RESOURCE,
        account: wallet,
        roleBitmap: lockedWrapperRootRoleBitmap(classified.fuses),
      },
    )
  }

  if (classified.managerAddress) {
    innerExecutions.push({
      phase: 'manager-role-grant',
      name,
      names: [name],
      call: buildRoleGrantCall(classified),
    })
    verificationExpectations.push({
      id: expectationId(name, 'manager-role'),
      type: 'manager-role',
      name,
      label: classified.label,
      registry: V2_CONTRACTS.ETHRegistry,
      resource: labelToCanonicalId(classified.label),
      account: classified.managerAddress,
      roleBitmap: ROLE_SET_RESOLVER,
    })
  }

  const profileEntry = profileForName(classified, profiles)
  if (profileEntry) {
    const profileCalls = flattenProfileInnerCalls(
      new Map([[profileEntry.node, profileEntry.profile]]),
    )
    innerExecutions.push({
      phase: 'profile-replay',
      name,
      names: [name],
      call: wrapInnerCallsAsMulticall(resolver, profileCalls),
    })
    verificationExpectations.push(
      ...profileEntry.profile.texts.map((record, index) => ({
        id: expectationId(name, 'profile-text', `${index}:${record.key}`),
        type: 'profile-text' as const,
        name,
        node: profileEntry.node,
        resolver,
        key: record.key,
        value: record.value,
      })),
      ...profileEntry.profile.addresses.map((record, index) => ({
        id: expectationId(
          name,
          'profile-address',
          `${index}:${record.coinType}`,
        ),
        type: 'profile-address' as const,
        name,
        node: profileEntry.node,
        resolver,
        coinType: record.coinType,
        value: record.value,
      })),
      ...(profileEntry.profile.contentHash
        ? [
            {
              id: expectationId(name, 'profile-contenthash'),
              type: 'profile-contenthash' as const,
              name,
              node: profileEntry.node,
              resolver,
              value: profileEntry.profile.contentHash,
            },
          ]
        : []),
      ...profileEntry.profile.abis.map((record, index) => ({
        id: expectationId(
          name,
          'profile-abi',
          `${index}:${record.contentType}`,
        ),
        type: 'profile-abi' as const,
        name,
        node: profileEntry.node,
        resolver,
        contentType: record.contentType,
        value: record.value,
      })),
    )
  }

  return {
    classified,
    directRoute,
    migrationData,
    innerExecutions,
    verificationExpectations,
  }
}

const buildNameExecutions = (params: {
  readonly chainId: number
  readonly hca: Address
  readonly wallet: Address
  readonly classified: readonly ClassifiedName[]
  readonly directRoutes: ReadonlyMap<string, DirectMigrationRoute>
  readonly profiles: ReadonlyMap<Hex, Profile>
  readonly resolver: Address
  readonly defaultResolver: Address
  readonly resolverDeployed: boolean
  readonly walletCoAdminGranted: boolean
}): readonly AtomicMigrationNameExecution[] => {
  const ordered = orderDirectMigrationNamesParentFirst(params.classified)
  const firstResolverNameIndex = ordered.findIndex(
    (name) => name.resolverStrategy === 'to-owned-permres',
  )

  return ordered.map((classified, index) => {
    const receivesResolverSetup = index === firstResolverNameIndex
    const directRoute = params.directRoutes.get(classified.domain.name)
    if (!directRoute) {
      throw new Error(
        `No verified migration route for "${classified.domain.name}"`,
      )
    }
    return buildNameExecution({
      ...params,
      classified,
      directRoute,
      includeResolverVerification: receivesResolverSetup,
      includeResolverDeployment:
        receivesResolverSetup && !params.resolverDeployed,
      includeWalletCoAdminGrant:
        receivesResolverSetup &&
        (!params.resolverDeployed || !params.walletCoAdminGranted),
    })
  })
}

/**
 * Finalize one outer HCA batch in contract-safe phase order. Helper inputs are
 * rebuilt from the names currently in the batch, so gas splitting and retry
 * removal cannot leave stale migration calldata behind.
 */
export const buildAtomicMigrationInnerExecutions = (params: {
  readonly nameExecutions: readonly AtomicMigrationNameExecution[]
}): readonly AtomicMigrationInnerExecution[] => {
  const existingInner = params.nameExecutions.flatMap(
    (nameExecution) => nameExecution.innerExecutions,
  )
  const helperInputs = params.nameExecutions.map<MigrationHelperNameInput>(
    ({ classified, migrationData }) => ({
      name: classified.domain.name,
      tokenType: classified.tokenType,
      parentName: classified.parentName,
      data: migrationData,
    }),
  )
  const firstMigration = helperInputs[0]
  const helperExecutions: readonly AtomicMigrationInnerExecution[] =
    firstMigration
      ? [
          {
            phase: 'migrate',
            name: firstMigration.name,
            names: helperInputs.map(({ name }) => name),
            call: buildMigrationHelperCall(helperInputs),
          },
        ]
      : []

  const executionsForPhase = (
    phase: Exclude<AtomicMigrationExecutionPhase, 'migrate'>,
  ): readonly AtomicMigrationInnerExecution[] =>
    existingInner.filter((execution) => execution.phase === phase)

  return [
    ...executionsForPhase('resolver-deployment'),
    ...executionsForPhase('wallet-co-admin-grant'),
    ...helperExecutions,
    ...executionsForPhase('manager-role-grant'),
    ...executionsForPhase('profile-replay'),
  ]
}

const estimateBatch = async (params: {
  readonly index: number
  readonly hca: Address
  readonly wallet: Address
  readonly nameExecutions: readonly AtomicMigrationNameExecution[]
  readonly estimateOuterGas: EstimateAtomicMigrationOuterGas
}): Promise<AtomicMigrationBatch> => {
  const innerExecutions = buildAtomicMigrationInnerExecutions({
    nameExecutions: params.nameExecutions,
  })
  const names = params.nameExecutions.map(
    (nameExecution) => nameExecution.classified.domain.name,
  )
  const outerCall: Call = buildHcaOwnerExecutionCall({
    hca: params.hca,
    calls: innerExecutions.map((execution) => execution.call),
  })
  const estimatedGas = await params.estimateOuterGas({
    call: outerCall,
    names,
    innerExecutions,
  })

  return {
    index: params.index,
    names,
    nameExecutions: params.nameExecutions,
    innerExecutions,
    outerCall,
    estimatedGas,
    verificationExpectations: params.nameExecutions.flatMap(
      (nameExecution) => nameExecution.verificationExpectations,
    ),
  }
}

type EstimateAtomicPrefix = (size: number) => Promise<AtomicMigrationBatch>

const createAtomicPrefixEstimator = (params: {
  readonly hca: Address
  readonly wallet: Address
  readonly nameExecutions: readonly AtomicMigrationNameExecution[]
  readonly estimateOuterGas: EstimateAtomicMigrationOuterGas
}): EstimateAtomicPrefix => {
  const attempts = new Map<number, Promise<AtomicMigrationBatch>>()

  return (size) => {
    const cached = attempts.get(size)
    if (cached) return cached

    const pending = estimateBatch({
      index: 0,
      hca: params.hca,
      wallet: params.wallet,
      nameExecutions: params.nameExecutions.slice(0, size),
      estimateOuterGas: params.estimateOuterGas,
    })
    attempts.set(size, pending)
    return pending
  }
}

const singleNameGasLimitError = (
  batch: AtomicMigrationBatch,
  maxOuterGas: bigint,
): AtomicMigrationNameGasLimitExceededError =>
  new AtomicMigrationNameGasLimitExceededError({
    ensName: batch.names[0] ?? 'unknown',
    estimatedGas: batch.estimatedGas,
    maxOuterGas,
  })

const findLargestAtomicPrefixWithinGasLimit = async (params: {
  readonly overLimitSize: number
  readonly maxOuterGas: bigint
  readonly estimatePrefix: EstimateAtomicPrefix
}): Promise<AtomicMigrationBatch> => {
  let lowerSize = 1
  let upperSize = params.overLimitSize
  let lowerBatch = await params.estimatePrefix(lowerSize)
  if (lowerBatch.estimatedGas > params.maxOuterGas) {
    throw singleNameGasLimitError(lowerBatch, params.maxOuterGas)
  }

  while (upperSize - lowerSize > 1) {
    const midpoint = Math.floor((lowerSize + upperSize) / 2)
    const candidate = await params.estimatePrefix(midpoint)
    if (candidate.estimatedGas <= params.maxOuterGas) {
      lowerSize = midpoint
      lowerBatch = candidate
      continue
    }
    upperSize = midpoint
  }

  return lowerBatch
}

/**
 * Verifies the preview-derived leading batch with one live estimate.
 *
 * The preview already controls batch sizing, so execution does not grow past
 * that boundary. If its live estimate numerically exceeds the execution limit,
 * a downward binary search finds a safe prefix. Estimate errors are propagated
 * immediately instead of being mistaken for a splittable gas boundary.
 */
const buildFirstAtomicMigrationBatch = async (params: {
  readonly hca: Address
  readonly wallet: Address
  readonly nameExecutions: readonly AtomicMigrationNameExecution[]
  readonly maxOuterGas: bigint
  readonly estimateOuterGas: EstimateAtomicMigrationOuterGas
  readonly initialBatchSize?: number
}): Promise<AtomicMigrationBatch | null> => {
  const total = params.nameExecutions.length
  if (total === 0) return null

  const requestedHint = Math.trunc(params.initialBatchSize ?? 1)
  const hint = Math.min(
    total,
    Math.max(1, Number.isFinite(requestedHint) ? requestedHint : 1),
  )
  const estimatePrefix = createAtomicPrefixEstimator(params)
  const hintedBatch = await estimatePrefix(hint)
  if (hintedBatch.estimatedGas <= params.maxOuterGas) return hintedBatch

  return findLargestAtomicPrefixWithinGasLimit({
    overLimitSize: hint,
    maxOuterGas: params.maxOuterGas,
    estimatePrefix,
  })
}

/**
 * Builds all-or-nothing HCA owner executions and greedily partitions them using
 * estimates of the fully wrapped `executeByOwner` call. A name is never split
 * across outer calls.
 */
export const buildAtomicMigrationBatches = async (
  params: BuildAtomicMigrationBatchesParams,
): Promise<AtomicMigrationBatchPlan> => {
  if (params.maxOuterGas <= 0n) {
    throw new Error('buildAtomicMigrationBatches: maxOuterGas must be positive')
  }

  const resolver = computeResolverAddress({
    chainId: params.chainId,
    hca: params.hca,
  })
  const nameExecutions = buildNameExecutions({
    ...params,
    resolver,
    defaultResolver: params.defaultResolver ?? V2_CONTRACTS.DefaultResolver,
  })

  if (params.firstBatchOnly) {
    const batch = await buildFirstAtomicMigrationBatch({
      hca: params.hca,
      wallet: params.wallet,
      nameExecutions,
      maxOuterGas: params.maxOuterGas,
      estimateOuterGas: params.estimateOuterGas,
      initialBatchSize: params.initialBatchSize,
    })
    return { resolver, batches: batch ? [batch] : [] }
  }

  const batches: AtomicMigrationBatch[] = []
  let currentNameExecutions: readonly AtomicMigrationNameExecution[] = []
  let currentBatch: AtomicMigrationBatch | null = null

  for (const nameExecution of nameExecutions) {
    const candidateNameExecutions = [...currentNameExecutions, nameExecution]
    const candidate = await estimateBatch({
      index: batches.length,
      hca: params.hca,
      wallet: params.wallet,
      nameExecutions: candidateNameExecutions,
      estimateOuterGas: params.estimateOuterGas,
    })

    if (candidate.estimatedGas <= params.maxOuterGas) {
      currentNameExecutions = candidateNameExecutions
      currentBatch = candidate
      continue
    }

    if (!currentBatch) {
      throw new AtomicMigrationNameGasLimitExceededError({
        ensName: nameExecution.classified.domain.name,
        estimatedGas: candidate.estimatedGas,
        maxOuterGas: params.maxOuterGas,
      })
    }

    batches.push(currentBatch)
    const singleNameBatch = await estimateBatch({
      index: batches.length,
      hca: params.hca,
      wallet: params.wallet,
      nameExecutions: [nameExecution],
      estimateOuterGas: params.estimateOuterGas,
    })
    if (singleNameBatch.estimatedGas > params.maxOuterGas) {
      throw new AtomicMigrationNameGasLimitExceededError({
        ensName: nameExecution.classified.domain.name,
        estimatedGas: singleNameBatch.estimatedGas,
        maxOuterGas: params.maxOuterGas,
      })
    }
    currentNameExecutions = [nameExecution]
    currentBatch = singleNameBatch
  }

  if (currentBatch) batches.push(currentBatch)
  return { resolver, batches }
}
