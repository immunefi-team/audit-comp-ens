/**
 * Standalone-HCA registration call builders (commit + reveal batch).
 *
 * Pure encoders + a few read helpers. No SDK/session concerns here — the
 * machine composes these into Rhinestone requests. Every call sets `value: 0`.
 *
 * The reveal batch order is EXACT and load-bearing (per the doc):
 *   1. VerifiableFactory.deployProxy(...)      — omit when the resolver exists
 *   2. paymentToken.approve(ETHRegistrar, price)
 *   3. ETHRegistrar.register(..., wallet as owner, ...)
 *   4. resolver setters                        — only selected records
 *   5. DefaultReverseRegistrarAdapter.setNameWithHCA(wallet, name) — primary only
 *   6. PermissionedResolver.authorizeNameRoles(hex"00", ROLES.ALL, wallet, true)
 *
 * Price MUST be read immediately before the reveal (never cached from commit
 * time) via `readRegisterPrice`, and `approve` must approve exactly that price.
 */

import {
  publicResolverSetAddrSnippet,
  publicResolverSetTextSnippet,
} from '@ensdomains/ensjs-abi/v1/publicResolver'
import { permissionedResolverAuthorizeNameRolesSnippet } from '@ensdomains/ensjs-abi/v2/permissionedResolver'
import { verifiableFactoryDeployProxySnippet } from '@ensdomains/ensjs-abi/v2/verifiableFactory'
import {
  type Address,
  encodeFunctionData,
  type Hex,
  namehash,
  type PublicClient,
  parseAbi,
} from 'viem'
import { computeVerifiableProxyAddress } from '../../verifiable-factory'
import {
  COIN_TYPE_ETH,
  computeResolverSalt,
  getDestinationContracts,
  REFERER,
  ROLES_ALL,
  ZERO_ADDRESS,
} from './manifest'

export interface Call {
  readonly to: Address
  readonly value: bigint
  readonly data: Hex
}

const ethRegistrarAbi = parseAbi([
  'function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) view returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)',
  'function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer)',
  'function MIN_COMMITMENT_AGE() view returns (uint64)',
  'function MAX_COMMITMENT_AGE() view returns (uint64)',
])
/**
 * `PermissionedResolver.initialize(admin, roleBitmap, setters)` — the third
 * `setters` arg is not modelled by ensjs-abi's 2-arg `proxyInitializeSnippet`,
 * so this one stays local. Every other ABI here comes from `@ensdomains/ensjs-abi`.
 */
const permissionedResolverInitializeAbi = parseAbi([
  'function initialize(address owner, uint256 roles, bytes[] data)',
])
const reverseAdapterAbi = parseAbi([
  'function setNameWithHCA(address addr, string name)',
])
const erc20Abi = parseAbi(['function approve(address spender, uint256 amount)'])

/** `<address-without-0x>.addr.reverse` reverse name for an address. */
export function ethReverseName(address: Address): string {
  return `${address.slice(2).toLowerCase()}.addr.reverse`
}

/**
 * Compute the resolver (PermissionedResolver proxy) address for an HCA, without
 * a chain read — the VerifiableFactory CREATE2 address for the derived salt.
 */
export function computeResolverAddress(params: {
  readonly chainId: number
  readonly hca: Address
}): Address {
  const c = getDestinationContracts(params.chainId)
  const salt = computeResolverSalt(params.hca)
  return computeVerifiableProxyAddress({
    factory: c.verifiableFactory,
    proxyLogic: c.verifiableFactoryProxyLogic,
    deployer: params.hca,
    salt,
  })
}

/** Read the commitment hash from the registrar (matches on-chain derivation). */
export async function readCommitment(params: {
  readonly publicClient: PublicClient
  readonly chainId: number
  readonly label: string
  readonly wallet: Address
  readonly secret: Hex
  readonly resolver: Address
  /** Registration duration (seconds). MUST be identical at commit and reveal. */
  readonly duration: bigint
}): Promise<Hex> {
  const c = getDestinationContracts(params.chainId)
  return params.publicClient.readContract({
    address: c.ethRegistrar,
    abi: ethRegistrarAbi,
    functionName: 'makeCommitment',
    args: [
      params.label,
      params.wallet,
      params.secret,
      ZERO_ADDRESS,
      params.resolver,
      params.duration,
      REFERER,
    ],
  })
}

/**
 * Read the registrar's commitment-age window (immutables — set at deploy, so
 * they must be READ, not hardcoded). Reveal is valid in
 * `(commitTime + min, commitTime + max)`.
 */
export async function readCommitmentAges(params: {
  readonly publicClient: PublicClient
  readonly chainId: number
}): Promise<{ minCommitmentAge: bigint; maxCommitmentAge: bigint }> {
  const c = getDestinationContracts(params.chainId)
  const [minCommitmentAge, maxCommitmentAge] = await Promise.all([
    params.publicClient.readContract({
      address: c.ethRegistrar,
      abi: ethRegistrarAbi,
      functionName: 'MIN_COMMITMENT_AGE',
    }),
    params.publicClient.readContract({
      address: c.ethRegistrar,
      abi: ethRegistrarAbi,
      functionName: 'MAX_COMMITMENT_AGE',
    }),
  ])
  return { minCommitmentAge, maxCommitmentAge }
}

/** Build the `ETHRegistrar.commit(commitment)` call. */
export function buildCommitCall(params: {
  readonly chainId: number
  readonly commitment: Hex
}): Call {
  const c = getDestinationContracts(params.chainId)
  return {
    to: c.ethRegistrar,
    value: 0n,
    data: encodeFunctionData({
      abi: ethRegistrarAbi,
      functionName: 'commit',
      args: [params.commitment],
    }),
  }
}

/** Read the current registration price (base + premium). Call immediately before reveal. */
export async function readRegisterPrice(params: {
  readonly publicClient: PublicClient
  readonly chainId: number
  readonly label: string
  /** Registration duration (seconds) — same value as the commitment. */
  readonly duration: bigint
}): Promise<bigint> {
  const c = getDestinationContracts(params.chainId)
  const [base, premium] = await params.publicClient.readContract({
    address: c.ethRegistrar,
    abi: ethRegistrarAbi,
    functionName: 'getRegisterPrice',
    args: [params.label, params.duration, c.usdc],
  })
  return base + premium
}

export interface ResolverRecord {
  readonly type: 'addr' | 'text'
  readonly key?: string
  readonly value: string
}

export interface RevealBatchParams {
  readonly chainId: number
  readonly hca: Address
  readonly resolver: Address
  /** True when the resolver already has code (skip deployProxy). */
  readonly resolverDeployed: boolean
  readonly label: string
  readonly wallet: Address
  readonly secret: Hex
  /** Current price from `readRegisterPrice`, read immediately before reveal. */
  readonly price: bigint
  /** Registration duration (seconds). MUST equal the commitment's duration. */
  readonly duration: bigint
  /** Optional resolver records to write (addr for the wallet is added by default). */
  readonly records?: readonly ResolverRecord[]
  /** When set, adds the primary-name (default.reverse) call. */
  readonly setPrimaryName?: string
}

/**
 * Build the exact-ordered reveal batch. See module doc for the ordering
 * contract. Every call has `value: 0`; if any call reverts the whole batch
 * reverts.
 */
export function buildRevealBatch(params: RevealBatchParams): Call[] {
  const c = getDestinationContracts(params.chainId)
  const name = `${params.label}.eth`
  const node = namehash(name)
  const calls: Call[] = []

  // The record writes for this name: the default `addr` (the wallet) plus any
  // selected text records. Always issued as standalone calls (step 4).
  const recordSetters: Hex[] = [
    encodeFunctionData({
      abi: publicResolverSetAddrSnippet,
      functionName: 'setAddr',
      args: [node, COIN_TYPE_ETH, params.wallet],
    }),
    ...(params.records ?? [])
      .filter((record) => record.type === 'text' && record.key)
      .map((record) =>
        encodeFunctionData({
          abi: publicResolverSetTextSnippet,
          functionName: 'setText',
          // biome-ignore lint/style/noNonNullAssertion: filtered on `key` above
          args: [node, record.key!, record.value],
        }),
      ),
  ]

  // 1. deployProxy (omit when resolver exists).
  //
  //    `setters` MUST be empty. `HCAOwnerAndSessionValidator._checkResolverDeployment`
  //    reconstructs the expected calldata as
  //      deployProxy(PERMITTED_RESOLVER_IMPL, salt, initialize(account, ALL_ROLES, []))
  //    and compares `keccak256(callData)` against it, so folding the record
  //    writes into `setters` — even though the resolver would happily execute
  //    them during initialization — makes the hashes differ and reverts with
  //    `PolicyRuleFailed()` (0xe50c42ea), which the emissary re-wraps as
  //    `InvalidSignature()`. Records go out as standalone calls in step 4;
  //    their selectors are individually whitelisted by the same policy.
  if (!params.resolverDeployed) {
    const salt = computeResolverSalt(params.hca)
    calls.push({
      to: c.verifiableFactory,
      value: 0n,
      data: encodeFunctionData({
        abi: verifiableFactoryDeployProxySnippet,
        functionName: 'deployProxy',
        args: [
          c.permissionedResolverImpl,
          salt,
          encodeFunctionData({
            abi: permissionedResolverInitializeAbi,
            functionName: 'initialize',
            args: [params.hca, ROLES_ALL, []],
          }),
        ],
      }),
    })
  }

  // 2. approve(price)
  calls.push({
    to: c.usdc,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [c.ethRegistrar, params.price],
    }),
  })

  // 3. register(wallet as owner)
  calls.push({
    to: c.ethRegistrar,
    value: 0n,
    data: encodeFunctionData({
      abi: ethRegistrarAbi,
      functionName: 'register',
      args: [
        params.label,
        params.wallet,
        params.secret,
        ZERO_ADDRESS,
        params.resolver,
        params.duration,
        c.usdc,
        REFERER,
      ],
    }),
  })

  // 4. resolver setters — ALWAYS standalone, on both the fresh-deploy and the
  //    existing-resolver path (see step 1: the policy forbids folding them into
  //    `initialize`). These are ordinary permissioned writes, authorized because
  //    the HCA holds the root roles granted by `initialize`.
  for (const data of recordSetters) {
    calls.push({ to: params.resolver, value: 0n, data })
  }

  // 5. primary name (default.reverse) — only when selected
  if (params.setPrimaryName) {
    calls.push({
      to: c.defaultReverseRegistrarHcaAdapter,
      value: 0n,
      data: encodeFunctionData({
        abi: reverseAdapterAbi,
        functionName: 'setNameWithHCA',
        args: [params.wallet, params.setPrimaryName],
      }),
    })
  }

  // 6. authorizeNameRoles(hex"00", ROLES.ALL, wallet, true) — every session registration
  calls.push({
    to: params.resolver,
    value: 0n,
    data: encodeFunctionData({
      abi: permissionedResolverAuthorizeNameRolesSnippet,
      functionName: 'authorizeNameRoles',
      args: ['0x00', ROLES_ALL, params.wallet, true],
    }),
  })

  return calls
}

/** Build the USDC `approve(spender, amount)` call (used for source funding). */
export function buildUsdcApproveCall(params: {
  readonly chainId: number
  readonly spender: Address
  readonly amount: bigint
}): Call {
  const c = getDestinationContracts(params.chainId)
  return {
    to: c.usdc,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [params.spender, params.amount],
    }),
  }
}
