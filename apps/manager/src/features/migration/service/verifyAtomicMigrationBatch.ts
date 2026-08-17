import { TaggedError } from '@ens-apps/utils/neverthrow'
import {
  type Address,
  isAddressEqual,
  type PublicClient,
  parseAbi,
  zeroAddress,
} from 'viem'

import type {
  AtomicMigrationBatch,
  AtomicMigrationBatchVerification,
  AtomicMigrationRegistryPath,
  AtomicMigrationVerificationExpectation,
} from './buildAtomicMigrationBatches'

const verifiableFactoryAbi = parseAbi([
  'function verifyContract(address proxy) view returns (address implementation)',
])

const permissionedRegistryReadAbi = parseAbi([
  'function getSubregistry(string label) view returns (address)',
  'function getOwner(uint256 anyId) view returns (address)',
  'function getResolver(string label) view returns (address)',
  'function hasRoles(uint256 anyId, uint256 roleBitmap, address account) view returns (bool)',
])

const permissionedResolverReadAbi = parseAbi([
  'function hasRootRoles(uint256 roleBitmap, address account) view returns (bool)',
  'function text(bytes32 node, string key) view returns (string)',
  'function addr(bytes32 node, uint256 coinType) view returns (bytes)',
  'function contenthash(bytes32 node) view returns (bytes)',
  'function ABI(bytes32 node, uint256 contentTypes) view returns (uint256, bytes)',
])

const wrapperRegistryReadAbi = parseAbi([
  'function getWrappedNode() view returns (bytes32)',
])

export type ConfirmedAtomicMigrationBatchVerification = Extract<
  AtomicMigrationBatchVerification,
  { readonly status: 'confirmed' }
>

export type AtomicMigrationExpectationFailure = {
  readonly expectationId: string
  readonly cause?: unknown
}

export type AtomicMigrationBatchReconciliation =
  | {
      readonly status: 'complete'
      readonly verification: ConfirmedAtomicMigrationBatchVerification
    }
  | {
      readonly status: 'incomplete'
      readonly verification: ConfirmedAtomicMigrationBatchVerification
      readonly mismatches: readonly AtomicMigrationExpectationFailure[]
    }

export class AtomicMigrationBatchVerificationError extends TaggedError(
  'AtomicMigrationBatchVerificationError',
)<{
  readonly message: string
  readonly batchIndex: number
  readonly verification: ConfirmedAtomicMigrationBatchVerification
  readonly failures: readonly AtomicMigrationExpectationFailure[]
}> {}

export class AtomicMigrationBatchReconciliationIndeterminateError extends TaggedError(
  'AtomicMigrationBatchReconciliationIndeterminateError',
)<{
  readonly message: string
  readonly batchIndex: number
  readonly readFailures: readonly AtomicMigrationExpectationFailure[]
  readonly cause?: unknown
}> {}

class DeterministicExpectationMismatchError extends Error {}

type ReadContext = {
  readonly publicClient: PublicClient
  readonly blockNumber?: bigint
  readonly codeCache: Map<string, Promise<boolean>>
  readonly registryCache: Map<string, Promise<Address>>
  readonly wrapperRegistryCache: Map<string, Promise<Address>>
}

const readAtBlock = (blockNumber: bigint | undefined) =>
  blockNumber === undefined ? {} : { blockNumber }

const hasContractCode = (
  context: ReadContext,
  address: Address,
): Promise<boolean> => {
  const cacheKey = address.toLowerCase()
  const cached = context.codeCache.get(cacheKey)
  if (cached) return cached

  const read = context.publicClient
    .getCode({ address, ...readAtBlock(context.blockNumber) })
    .then((code) => Boolean(code && code !== '0x'))
  context.codeCache.set(cacheKey, read)
  return read
}

/** Starting at ETHRegistry, omit the `eth` suffix and walk root-to-leaf. */
const parentLabelsRootFirst = (parentName: string): readonly string[] => {
  const labels = parentName.split('.')
  const withoutEth =
    labels.at(-1)?.toLowerCase() === 'eth' ? labels.slice(0, -1) : labels
  return [...withoutEth].reverse()
}

const resolveSubregistry = (
  context: ReadContext,
  rootRegistry: Address,
  labels: readonly string[],
): Promise<Address> => {
  const cacheKey = `${rootRegistry.toLowerCase()}:${labels.join('.')}`
  const cached = context.registryCache.get(cacheKey)
  if (cached) return cached

  const resolution = (async (): Promise<Address> => {
    let registry = rootRegistry
    for (const label of labels) {
      const subregistry = await context.publicClient.readContract({
        address: registry,
        abi: permissionedRegistryReadAbi,
        functionName: 'getSubregistry',
        args: [label],
        ...readAtBlock(context.blockNumber),
      })
      if (isAddressEqual(subregistry, zeroAddress)) {
        throw new DeterministicExpectationMismatchError(
          `Missing subregistry for "${label}" while resolving ${labels.join('.')}`,
        )
      }
      registry = subregistry
    }
    return registry
  })()

  context.registryCache.set(cacheKey, resolution)
  return resolution
}

const resolveRegistryPath = (
  context: ReadContext,
  path: AtomicMigrationRegistryPath,
): Promise<Address> => {
  if (path.type === 'eth-registry-2ld') {
    return Promise.resolve(path.registry)
  }
  return resolveSubregistry(
    context,
    path.rootRegistry,
    parentLabelsRootFirst(path.parentName),
  )
}

const resolveRegistryForName = (
  context: ReadContext,
  rootRegistry: Address,
  name: string,
): Promise<Address> => {
  const labels = name.split('.')
  const parentName = labels.slice(1).join('.')
  return resolveSubregistry(
    context,
    rootRegistry,
    parentLabelsRootFirst(parentName),
  )
}

const resolveWrapperRegistry = (
  context: ReadContext,
  params: {
    readonly name: string
    readonly label: string
    readonly registryPath: AtomicMigrationRegistryPath
  },
): Promise<Address> => {
  const cached = context.wrapperRegistryCache.get(params.name)
  if (cached) return cached

  const resolution = (async (): Promise<Address> => {
    const registry = await resolveRegistryPath(context, params.registryPath)
    const subregistry = await context.publicClient.readContract({
      address: registry,
      abi: permissionedRegistryReadAbi,
      functionName: 'getSubregistry',
      args: [params.label],
      ...readAtBlock(context.blockNumber),
    })
    if (isAddressEqual(subregistry, zeroAddress)) {
      throw new DeterministicExpectationMismatchError(
        `Missing WrapperRegistry for "${params.name}"`,
      )
    }
    return subregistry
  })()

  context.wrapperRegistryCache.set(params.name, resolution)
  return resolution
}

const checkExpectation = async (
  context: ReadContext,
  expectation: AtomicMigrationVerificationExpectation,
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this exhaustive switch mirrors the verification expectation union and keeps each on-chain assertion visibly fail-closed.
): Promise<boolean> => {
  const block = readAtBlock(context.blockNumber)

  switch (expectation.type) {
    case 'resolver-implementation': {
      if (!(await hasContractCode(context, expectation.resolver))) return false
      const implementation = await context.publicClient.readContract({
        address: expectation.factory,
        abi: verifiableFactoryAbi,
        functionName: 'verifyContract',
        args: [expectation.resolver],
        ...block,
      })
      return isAddressEqual(implementation, expectation.expectedImplementation)
    }
    case 'resolver-root-roles': {
      if (expectation.rootName !== '0x00') return false
      if (!(await hasContractCode(context, expectation.resolver))) return false
      return context.publicClient.readContract({
        address: expectation.resolver,
        abi: permissionedResolverReadAbi,
        functionName: 'hasRootRoles',
        args: [expectation.roleBitmap, expectation.account],
        ...block,
      })
    }
    case 'wallet-name-roles': {
      if (expectation.rootName !== '0x00') return false
      if (!(await hasContractCode(context, expectation.resolver))) return false
      return context.publicClient.readContract({
        address: expectation.resolver,
        abi: permissionedResolverReadAbi,
        functionName: 'hasRootRoles',
        args: [expectation.roleBitmap, expectation.account],
        ...block,
      })
    }
    case 'name-owner': {
      const registry = await resolveRegistryPath(
        context,
        expectation.registryPath,
      )
      const owner = await context.publicClient.readContract({
        address: registry,
        abi: permissionedRegistryReadAbi,
        functionName: 'getOwner',
        args: [expectation.resource],
        ...block,
      })
      return isAddressEqual(owner, expectation.expectedOwner)
    }
    case 'name-resolver': {
      const registry = await resolveRegistryPath(
        context,
        expectation.registryPath,
      )
      const resolver = await context.publicClient.readContract({
        address: registry,
        abi: permissionedRegistryReadAbi,
        functionName: 'getResolver',
        args: [expectation.label],
        ...block,
      })
      return isAddressEqual(resolver, expectation.expectedResolver)
    }
    case 'name-owner-roles': {
      const registry = await resolveRegistryPath(
        context,
        expectation.registryPath,
      )
      return context.publicClient.readContract({
        address: registry,
        abi: permissionedRegistryReadAbi,
        functionName: 'hasRoles',
        args: [
          expectation.resource,
          expectation.roleBitmap,
          expectation.account,
        ],
        ...block,
      })
    }
    case 'wrapper-subregistry': {
      const wrapperRegistry = await resolveWrapperRegistry(context, expectation)
      if (
        !isAddressEqual(wrapperRegistry, expectation.expectedWrapperRegistry)
      ) {
        return false
      }
      if (!(await hasContractCode(context, wrapperRegistry))) return false
      const [implementation, wrappedNode] = await Promise.all([
        context.publicClient.readContract({
          address: expectation.factory,
          abi: verifiableFactoryAbi,
          functionName: 'verifyContract',
          args: [wrapperRegistry],
          ...block,
        }),
        context.publicClient.readContract({
          address: wrapperRegistry,
          abi: wrapperRegistryReadAbi,
          functionName: 'getWrappedNode',
          ...block,
        }),
      ])
      return (
        isAddressEqual(implementation, expectation.expectedImplementation) &&
        wrappedNode.toLowerCase() === expectation.node.toLowerCase()
      )
    }
    case 'wrapper-root-roles': {
      const wrapperRegistry = await resolveWrapperRegistry(context, expectation)
      if (!(await hasContractCode(context, wrapperRegistry))) return false
      return context.publicClient.readContract({
        address: wrapperRegistry,
        abi: permissionedRegistryReadAbi,
        functionName: 'hasRoles',
        args: [
          expectation.resource,
          expectation.roleBitmap,
          expectation.account,
        ],
        ...block,
      })
    }
    case 'manager-role': {
      const registry = await resolveRegistryForName(
        context,
        expectation.registry,
        expectation.name,
      )
      return context.publicClient.readContract({
        address: registry,
        abi: permissionedRegistryReadAbi,
        functionName: 'hasRoles',
        args: [
          expectation.resource,
          expectation.roleBitmap,
          expectation.account,
        ],
        ...block,
      })
    }
    case 'profile-text': {
      if (!(await hasContractCode(context, expectation.resolver))) return false
      const value = await context.publicClient.readContract({
        address: expectation.resolver,
        abi: permissionedResolverReadAbi,
        functionName: 'text',
        args: [expectation.node, expectation.key],
        ...block,
      })
      return value === expectation.value
    }
    case 'profile-address': {
      if (!(await hasContractCode(context, expectation.resolver))) return false
      const value = await context.publicClient.readContract({
        address: expectation.resolver,
        abi: permissionedResolverReadAbi,
        functionName: 'addr',
        args: [expectation.node, expectation.coinType],
        ...block,
      })
      return value.toLowerCase() === expectation.value.toLowerCase()
    }
    case 'profile-contenthash': {
      if (!(await hasContractCode(context, expectation.resolver))) return false
      const value = await context.publicClient.readContract({
        address: expectation.resolver,
        abi: permissionedResolverReadAbi,
        functionName: 'contenthash',
        args: [expectation.node],
        ...block,
      })
      return value.toLowerCase() === expectation.value.toLowerCase()
    }
    case 'profile-abi': {
      if (!(await hasContractCode(context, expectation.resolver))) return false
      const [contentType, value] = await context.publicClient.readContract({
        address: expectation.resolver,
        abi: permissionedResolverReadAbi,
        functionName: 'ABI',
        args: [expectation.node, expectation.contentType],
        ...block,
      })
      return (
        contentType === expectation.contentType &&
        value.toLowerCase() === expectation.value.toLowerCase()
      )
    }
  }
}

/**
 * Reads every expected post-state for a confirmed atomic migration batch.
 *
 * All reads are attempted so callers get a complete reconciliation result.
 * Any mismatch or failed read makes the verifier throw with those results;
 * callers must not emit `batchComplete` in that case.
 */
export const verifyAtomicMigrationBatch = async (params: {
  readonly publicClient: PublicClient
  readonly batch: Pick<
    AtomicMigrationBatch,
    'index' | 'verificationExpectations'
  >
  readonly blockNumber?: bigint
}): Promise<ConfirmedAtomicMigrationBatchVerification> => {
  const context: ReadContext = {
    publicClient: params.publicClient,
    blockNumber: params.blockNumber,
    codeCache: new Map(),
    registryCache: new Map(),
    wrapperRegistryCache: new Map(),
  }
  const checked = await Promise.all(
    params.batch.verificationExpectations.map(async (expectation) => {
      try {
        return {
          result: {
            expectationId: expectation.id,
            satisfied: await checkExpectation(context, expectation),
          },
        }
      } catch (cause) {
        return {
          result: { expectationId: expectation.id, satisfied: false },
          ...(cause instanceof DeterministicExpectationMismatchError
            ? {}
            : { cause }),
        }
      }
    }),
  )
  const verification: ConfirmedAtomicMigrationBatchVerification = {
    batchIndex: params.batch.index,
    status: 'confirmed',
    results: checked.map(({ result }) => result),
  }
  const failures = checked.flatMap(({ result, cause }) =>
    result.satisfied
      ? []
      : [{ expectationId: result.expectationId, ...(cause ? { cause } : {}) }],
  )

  if (failures.length > 0) {
    throw new AtomicMigrationBatchVerificationError({
      message: `Atomic migration batch ${params.batch.index} failed ${failures.length} post-state verification${failures.length === 1 ? '' : 's'}`,
      batchIndex: params.batch.index,
      verification,
      failures,
    })
  }

  return verification
}

/**
 * Classifies a latest-state post-condition check for retry without conflating a
 * deterministic mismatch with an RPC/read failure. Only a deterministic
 * mismatch is safe to rebuild; an indeterminate read must stop the retry.
 */
export const reconcileAtomicMigrationBatch = async (params: {
  readonly publicClient: PublicClient
  readonly batch: Pick<
    AtomicMigrationBatch,
    'index' | 'verificationExpectations'
  >
}): Promise<AtomicMigrationBatchReconciliation> => {
  try {
    const verification = await verifyAtomicMigrationBatch(params)
    return { status: 'complete', verification }
  } catch (error) {
    if (!(error instanceof AtomicMigrationBatchVerificationError)) {
      throw new AtomicMigrationBatchReconciliationIndeterminateError({
        message: `Atomic migration batch ${params.batch.index} could not be reconciled`,
        batchIndex: params.batch.index,
        readFailures: [],
        cause: error,
      })
    }

    const readFailures = error.failures.filter(
      (failure) => failure.cause !== undefined,
    )
    if (readFailures.length > 0) {
      throw new AtomicMigrationBatchReconciliationIndeterminateError({
        message: `Atomic migration batch ${params.batch.index} has ${readFailures.length} indeterminate post-state read${readFailures.length === 1 ? '' : 's'}`,
        batchIndex: params.batch.index,
        readFailures,
        cause: error,
      })
    }

    return {
      status: 'incomplete',
      verification: error.verification,
      mismatches: error.failures,
    }
  }
}
