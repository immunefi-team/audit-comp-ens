import { computeVerifiableProxyAddress } from '@ens-apps/smart-account'
import { TaggedError } from '@ens-apps/utils/neverthrow'
import {
  type Address,
  isAddressEqual,
  namehash,
  type PublicClient,
  parseAbi,
  zeroAddress,
} from 'viem'

import { V2_CONTRACTS } from '../contracts/addresses'
import type { ClassifiedName } from './classifyNames'

const verifiableFactoryAbi = parseAbi([
  'function verifyContract(address proxy) view returns (address implementation)',
])

const permissionedRegistryAbi = parseAbi([
  'function getSubregistry(string label) view returns (address)',
])

const wrapperRegistryAbi = parseAbi([
  'function getWrappedNode() view returns (bytes32)',
])

export type DirectMigrationRoute = {
  readonly name: string
  readonly receiver: Address
  readonly parentDependency: string | null
  /** Wrapper created by this migration, for locked names only. */
  readonly expectedWrapperRegistry: Address | null
  readonly receiverReadiness:
    | 'migration-controller'
    | 'created-earlier-in-plan'
    | 'existing-verified-wrapper'
}

export type DirectMigrationRouteFailure =
  | 'cyclic-route'
  | 'duplicate-name'
  | 'invalid-eth-name'
  | 'missing-parent'
  | 'parent-cannot-create-wrapper'
  | 'missing-wrapper'
  | 'conflicting-wrapper'
  | 'uncertified-wrapper'

export class DirectMigrationRouteError extends TaggedError(
  'DirectMigrationRouteError',
)<{
  readonly message: string
  readonly reason: DirectMigrationRouteFailure
  readonly ensName: string
  readonly parentName?: string
  readonly expected?: Address
  readonly actual?: Address
  readonly cause?: unknown
}> {}

const isChild = (name: ClassifiedName): boolean =>
  name.tokenType === 'locked-child' || name.tokenType === 'detached-child'

const createsWrapperRegistry = (name: ClassifiedName): boolean =>
  name.tokenType === 'locked-2ld' || name.tokenType === 'locked-child'

const labelsForEthName = (name: string): readonly string[] => {
  const labels = name.split('.')
  if (
    labels.length < 2 ||
    labels.some((label) => label.length === 0) ||
    labels.at(-1)?.toLowerCase() !== 'eth'
  ) {
    throw new DirectMigrationRouteError({
      message: `Cannot derive a WrapperRegistry route for non-.eth name "${name}"`,
      reason: 'invalid-eth-name',
      ensName: name,
    })
  }
  return labels
}

/**
 * Derive the wrapper proxy for any locked .eth name. Each nested wrapper is
 * deployed by its parent wrapper, beginning at LockedMigrationController.
 */
export const computeExpectedWrapperRegistry = (params: {
  readonly name: string
}): Address => {
  const labels = labelsForEthName(params.name)
  let deployer = V2_CONTRACTS.LockedMigrationController
  let wrapper: Address | null = null

  for (let index = labels.length - 2; index >= 0; index -= 1) {
    const wrappedName = labels.slice(index).join('.')
    wrapper = computeVerifiableProxyAddress({
      factory: V2_CONTRACTS.VerifiableFactory,
      proxyLogic: V2_CONTRACTS.VerifiableFactoryProxyLogic,
      deployer,
      salt: BigInt(namehash(wrappedName)),
    })
    deployer = wrapper
  }

  if (!wrapper) {
    throw new DirectMigrationRouteError({
      message: `Cannot derive a WrapperRegistry route for "${params.name}"`,
      reason: 'invalid-eth-name',
      ensName: params.name,
    })
  }
  return wrapper
}

/** Stable topological ordering used before gas partitioning. */
export const orderDirectMigrationNamesParentFirst = (
  classified: readonly ClassifiedName[],
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: keeping duplicate, dependency, and cycle validation in the same topological pass preserves the fail-closed ordering invariant.
): readonly ClassifiedName[] => {
  const byName = new Map<string, ClassifiedName>()
  for (const name of classified) {
    if (byName.has(name.domain.name)) {
      throw new DirectMigrationRouteError({
        message: `Migration selection contains duplicate name "${name.domain.name}"`,
        reason: 'duplicate-name',
        ensName: name.domain.name,
      })
    }
    byName.set(name.domain.name, name)
  }

  const childrenByParent = new Map<string, readonly ClassifiedName[]>()
  const inDegree = new Map<string, number>(
    classified.map((name) => [name.domain.name, 0]),
  )

  for (const name of classified) {
    if (!isChild(name)) continue
    if (!name.parentName) {
      throw new DirectMigrationRouteError({
        message: `Child migration "${name.domain.name}" has no parent`,
        reason: 'missing-parent',
        ensName: name.domain.name,
      })
    }

    const selectedParent = byName.get(name.parentName)
    if (!selectedParent) continue
    if (!createsWrapperRegistry(selectedParent)) {
      throw new DirectMigrationRouteError({
        message: `Selected parent "${name.parentName}" cannot create the WrapperRegistry required by "${name.domain.name}"`,
        reason: 'parent-cannot-create-wrapper',
        ensName: name.domain.name,
        parentName: name.parentName,
      })
    }

    inDegree.set(name.domain.name, (inDegree.get(name.domain.name) ?? 0) + 1)
    const children = childrenByParent.get(name.parentName) ?? []
    childrenByParent.set(name.parentName, [...children, name])
  }

  const queue = classified.filter(
    (name) => (inDegree.get(name.domain.name) ?? 0) === 0,
  )
  const ordered: ClassifiedName[] = []

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const name = queue[cursor]
    if (!name) continue
    ordered.push(name)

    for (const child of childrenByParent.get(name.domain.name) ?? []) {
      const remaining = (inDegree.get(child.domain.name) ?? 0) - 1
      inDegree.set(child.domain.name, remaining)
      if (remaining === 0) queue.push(child)
    }
  }

  if (ordered.length !== classified.length) {
    const emitted = new Set(ordered.map((name) => name.domain.name))
    const cyclicName = classified.find((name) => !emitted.has(name.domain.name))
    throw new DirectMigrationRouteError({
      message: `Migration selection contains a cyclic parent route involving "${cyclicName?.domain.name ?? 'unknown'}"`,
      reason: 'cyclic-route',
      ensName: cyclicName?.domain.name ?? 'unknown',
      ...(cyclicName?.parentName ? { parentName: cyclicName.parentName } : {}),
    })
  }

  return ordered
}

const assertVerifiedWrapper = async (params: {
  readonly publicClient: PublicClient
  readonly name: string
  readonly registry: Address
  readonly label: string
  readonly expectedWrapper: Address
}): Promise<void> => {
  const actualWrapper = await params.publicClient.readContract({
    address: params.registry,
    abi: permissionedRegistryAbi,
    functionName: 'getSubregistry',
    args: [params.label],
  })

  if (isAddressEqual(actualWrapper, zeroAddress)) {
    throw new DirectMigrationRouteError({
      message: `Parent WrapperRegistry for "${params.name}" has not been migrated`,
      reason: 'missing-wrapper',
      ensName: params.name,
      expected: params.expectedWrapper,
      actual: actualWrapper,
    })
  }
  if (!isAddressEqual(actualWrapper, params.expectedWrapper)) {
    throw new DirectMigrationRouteError({
      message: `Parent WrapperRegistry for "${params.name}" conflicts with the deterministic deployment`,
      reason: 'conflicting-wrapper',
      ensName: params.name,
      expected: params.expectedWrapper,
      actual: actualWrapper,
    })
  }

  try {
    const [code, implementation, wrappedNode] = await Promise.all([
      params.publicClient.getCode({ address: params.expectedWrapper }),
      params.publicClient.readContract({
        address: V2_CONTRACTS.VerifiableFactory,
        abi: verifiableFactoryAbi,
        functionName: 'verifyContract',
        args: [params.expectedWrapper],
      }),
      params.publicClient.readContract({
        address: params.expectedWrapper,
        abi: wrapperRegistryAbi,
        functionName: 'getWrappedNode',
      }),
    ])
    const hasCode = Boolean(code && code !== '0x')
    const hasExpectedImplementation = isAddressEqual(
      implementation,
      V2_CONTRACTS.WrapperRegistryImpl,
    )
    const hasExpectedNode =
      wrappedNode.toLowerCase() === namehash(params.name).toLowerCase()
    if (!hasCode || !hasExpectedImplementation || !hasExpectedNode) {
      throw new Error(
        `code=${hasCode}; implementation=${implementation}; wrappedNode=${wrappedNode}`,
      )
    }
  } catch (cause) {
    throw new DirectMigrationRouteError({
      message: `Parent WrapperRegistry for "${params.name}" is not factory-certified`,
      reason: 'uncertified-wrapper',
      ensName: params.name,
      expected: params.expectedWrapper,
      cause,
    })
  }
}

const verifyExistingWrapperChain = async (params: {
  readonly publicClient: PublicClient
  readonly name: string
}): Promise<Address> => {
  const labels = labelsForEthName(params.name)
  let registry = V2_CONTRACTS.ETHRegistry

  for (let index = labels.length - 2; index >= 0; index -= 1) {
    const wrappedName = labels.slice(index).join('.')
    const expectedWrapper = computeExpectedWrapperRegistry({
      name: wrappedName,
    })
    const label = labels[index]
    if (!label) {
      throw new DirectMigrationRouteError({
        message: `Cannot resolve the WrapperRegistry label for "${wrappedName}"`,
        reason: 'invalid-eth-name',
        ensName: wrappedName,
      })
    }
    await assertVerifiedWrapper({
      publicClient: params.publicClient,
      name: wrappedName,
      registry,
      label,
      expectedWrapper,
    })
    registry = expectedWrapper
  }

  return registry
}

/**
 * Resolve every helper migration receiver before asking the wallet to approve
 * MigrationHelper. Existing parent wrappers are verified recursively; selected
 * locked parents may satisfy a child route only when they execute earlier.
 */
export const resolveDirectMigrationRoutes = async (params: {
  readonly publicClient: PublicClient
  readonly classified: readonly ClassifiedName[]
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: route selection keeps all parent-readiness branches together so every child is assigned exactly one verified receiver.
}): Promise<ReadonlyMap<string, DirectMigrationRoute>> => {
  const ordered = orderDirectMigrationNamesParentFirst(params.classified)
  const selectedByName = new Map(
    ordered.map((name) => [name.domain.name, name] as const),
  )
  const verifiedExistingParents = new Map<string, Promise<Address>>()
  const routes = new Map<string, DirectMigrationRoute>()

  for (const name of ordered) {
    const ensName = name.domain.name
    const expectedWrapperRegistry = createsWrapperRegistry(name)
      ? computeExpectedWrapperRegistry({ name: ensName })
      : null

    if (!isChild(name)) {
      routes.set(ensName, {
        name: ensName,
        receiver:
          name.tokenType === 'locked-2ld'
            ? V2_CONTRACTS.LockedMigrationController
            : V2_CONTRACTS.UnlockedMigrationController,
        parentDependency: null,
        expectedWrapperRegistry,
        receiverReadiness: 'migration-controller',
      })
      continue
    }

    const parentName = name.parentName
    if (!parentName) {
      throw new DirectMigrationRouteError({
        message: `Child migration "${ensName}" has no parent`,
        reason: 'missing-parent',
        ensName,
      })
    }
    const expectedParentWrapper = computeExpectedWrapperRegistry({
      name: parentName,
    })
    const selectedParent = selectedByName.get(parentName)

    if (selectedParent) {
      if (!createsWrapperRegistry(selectedParent) || !routes.has(parentName)) {
        throw new DirectMigrationRouteError({
          message: `Parent "${parentName}" is not ready before "${ensName}"`,
          reason: 'parent-cannot-create-wrapper',
          ensName,
          parentName,
          expected: expectedParentWrapper,
        })
      }
      routes.set(ensName, {
        name: ensName,
        receiver: expectedParentWrapper,
        parentDependency: parentName,
        expectedWrapperRegistry,
        receiverReadiness: 'created-earlier-in-plan',
      })
      continue
    }

    const verification =
      verifiedExistingParents.get(parentName) ??
      verifyExistingWrapperChain({
        publicClient: params.publicClient,
        name: parentName,
      })
    verifiedExistingParents.set(parentName, verification)
    const verifiedParentWrapper = await verification
    if (!isAddressEqual(verifiedParentWrapper, expectedParentWrapper)) {
      throw new DirectMigrationRouteError({
        message: `Verified parent route for "${ensName}" resolved to an unexpected WrapperRegistry`,
        reason: 'conflicting-wrapper',
        ensName,
        parentName,
        expected: expectedParentWrapper,
        actual: verifiedParentWrapper,
      })
    }

    routes.set(ensName, {
      name: ensName,
      receiver: expectedParentWrapper,
      parentDependency: parentName,
      expectedWrapperRegistry,
      receiverReadiness: 'existing-verified-wrapper',
    })
  }

  return routes
}
