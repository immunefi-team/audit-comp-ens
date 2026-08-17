// Pure helpers and domain logic for MigrationTestPanel — no React, fully testable.

import { ensL1Contracts, supportedL1Chains } from '@ensdomains/ensjs/chain'
import { registrySetApprovalForAllSnippet } from '@ensdomains/ensjs-abi/registry'
import {
  baseRegistrarAddControllerSnippet,
  baseRegistrarControllersSnippet,
  baseRegistrarOwnerSnippet,
  baseRegistrarRegisterSnippet,
} from '@ensdomains/ensjs-abi/v1/baseRegistrar'
import {
  nameWrapperSetFusesSnippet,
  nameWrapperSetSubnodeOwnerSnippet,
  nameWrapperWrapEth2ldSnippet,
} from '@ensdomains/ensjs-abi/v1/nameWrapper'
import { userRegistryRegisterSnippet } from '@ensdomains/ensjs-abi/v2/userRegistry'
import {
  type Address,
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  hexToBytes,
  keccak256,
  toBytes,
  toHex,
} from 'viem'

const ensjsSepolia = ensL1Contracts[supportedL1Chains.sepolia]

// --- V1 contract addresses --------------------------------------------------
// V1 contracts sourced from the ensjs Sepolia chain config (same source as
// preflightChecks.ts) so they can't drift from the canonical deployment.
export const V1_BASE_REGISTRAR =
  ensjsSepolia.ensBaseRegistrarImplementation.address
export const V1_NAME_WRAPPER = ensjsSepolia.ensNameWrapper.address
// Fallback owner of the official Sepolia BaseRegistrar — impersonated to
// re-authorize DEFAULT_ACCOUNT as a controller. ENS revoked all V1 controllers
// at ~block 10927919 as part of the V2 migration cutover.
//
// The registrar's `owner()` has since been transferred on Sepolia, so this
// constant is only a last-resort fallback: `ensureFunded()` reads the live
// `owner()` off the fork and impersonates THAT. Hardcoding the owner is what
// silently broke name creation once ownership moved — impersonating a non-owner
// makes `addController` revert, so DEFAULT_ACCOUNT never becomes a controller
// and every `register()` reverts, leaving phantom names that only exist in the
// subgraph mock.
export const V1_BASE_REGISTRAR_OWNER =
  '0xB359d7d04F750E9C008A5a47Bd2b64134bD180F9' as const
export const V1_PUBLIC_RESOLVER =
  '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5' as const

// V2 contracts — sourced from the same ensjs Sepolia manifest as Manager's
// destination contract table so fixture reservations cannot drift to a retired
// deployment while the migration flow targets the active one.
export const V2_ETH_REGISTRY_ADDR = ensjsSepolia.ensRegistry.address
export const V2_ETH_REGISTRAR_ADDR = ensjsSepolia.ensEthRegistrar.address
const V2_MIGRATION_CONTROLLERS = [
  ensjsSepolia.ensUnlockedMigrationController.address,
  ensjsSepolia.ensLockedMigrationController.address,
] as const

/** Anvil account #0 — always has 10 000 ETH on a fresh fork. */
export const DEFAULT_ACCOUNT =
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const

export const ONE_YEAR = 365 * 24 * 3600

// Bonus added to a name's v1 expiry when it's reserved on v2 during pre-migration
// (contracts-v2 `PREMIGRATION_BONUS_PERIOD = 1 + (GRACE_PERIOD_V1 - GRACE_PERIOD_V2)`
// = ~62 days). The v2 slot stays RESERVED for this window, then AVAILABLE-renewable
// for another GRACE_PERIOD_V2 (28d) — 62 + 28 = 90 days = the full v1 grace, so a
// reserved v1 name is renewable throughout grace. Match it so seeded names have the
// SAME renewable window as production (rather than staying renewable indefinitely).
export const PREMIGRATION_BONUS_PERIOD = 1 + (90 - 28) * 24 * 3600
export const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as const

// --- Fuse bit masks (NameWrapper) -------------------------------------------
export const CANNOT_UNWRAP = 1 as const
export const CANNOT_BURN_FUSES = 2 as const
export const CANNOT_TRANSFER = 4 as const
export const CANNOT_SET_RESOLVER = 8 as const
export const CANNOT_SET_TTL = 16 as const
export const CANNOT_CREATE_SUBDOMAIN = 32 as const
export const CANNOT_APPROVE = 64 as const
export const PARENT_CANNOT_CONTROL = 1 << 16
export const IS_DOT_ETH = 1 << 17

export const ALL_CHILD_FUSES =
  CANNOT_UNWRAP |
  CANNOT_BURN_FUSES |
  CANNOT_TRANSFER |
  CANNOT_SET_RESOLVER |
  CANNOT_SET_TTL |
  CANNOT_CREATE_SUBDOMAIN |
  CANNOT_APPROVE

// --- Storage keys -----------------------------------------------------------
export const POSITION_STORAGE_KEY = 'ens:migration-tool:pos'

// --- Types ------------------------------------------------------------------
export type PresetType =
  | 'unwrapped'
  | 'wrapped'
  | 'locked'
  | 'locked-all'
  | 'grace'
  | 'grace-renewable-wrapped'
  | 'grace-renewable-unwrapped'
  | 'emancipated'

export interface ActiveName {
  label: string
  type: PresetType
  id: string
  /** Unix seconds — V1 expiry, used for subgraph mock and V2 reservation */
  expiryDate: number
}

export type Pos = { left: number; top: number }

// --- Preset definitions -----------------------------------------------------
export const PRESETS: { type: PresetType; label: string; title: string }[] = [
  { type: 'unwrapped', label: 'Unwrapped', title: 'ERC-721 on BaseRegistrar' },
  { type: 'wrapped', label: 'Wrapped', title: 'NameWrapper, no fuses' },
  {
    type: 'locked',
    label: 'Locked',
    title: 'NameWrapper, CANNOT_UNWRAP fuse burned',
  },
  {
    type: 'locked-all',
    label: 'Locked+All',
    title: 'NameWrapper, all 7 child fuses burned',
  },
  {
    type: 'grace',
    label: 'Grace Period',
    title: 'Locked name expired 45 days ago (clock advanced)',
  },
  {
    type: 'grace-renewable-wrapped',
    label: 'Grace RW (wrapped)',
    title:
      'Wrapped name in grace, v2 reservation active → isRenewable=true. NOTE: after renewal the NameWrapper token stays expired, so migration reverts with ERC1155 insufficient balance.',
  },
  {
    type: 'grace-renewable-unwrapped',
    label: 'Grace RW (unwrapped)',
    title:
      'Unwrapped name in grace, v2 reservation active → isRenewable=true. Renew then migrate works end-to-end (ERC-721 in BaseRegistrar).',
  },
  {
    type: 'emancipated',
    label: 'Emancipated',
    title: 'Locked subname with PARENT_CANNOT_CONTROL',
  },
]

export const TYPE_BADGE_COLORS: Record<PresetType, string> = {
  unwrapped: '#4b5563',
  wrapped: '#1d4ed8',
  locked: '#7c3aed',
  'locked-all': '#9333ea',
  grace: '#b45309',
  'grace-renewable-wrapped': '#c2410c',
  'grace-renewable-unwrapped': '#ea580c',
  emancipated: '#065f46',
}

// --- ABI fragments ----------------------------------------------------------
// All contract ABIs are sourced from @ensdomains/ensjs-abi per-function
// snippets (imported above). NameWrapper: wrapETH2LD / setFuses /
// setSubnodeOwner. BaseRegistrar: register / addController / owner /
// controllers. setApprovalForAll from the registry snippet (standard
// ERC-721/1155 method, encodes identically). V2 registry register from
// v2/userRegistry (identical param types; only names differ).

// --- Crypto helpers ---------------------------------------------------------

/** ETH namehash of "eth" */
export const ETH_NODE =
  '0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae' as const

export function labelhash(label: string): `0x${string}` {
  return keccak256(toBytes(label))
}

export function namehashFromLabelAndParent(
  labelHash: `0x${string}`,
  parentNode: `0x${string}`,
): `0x${string}` {
  return keccak256(concat([hexToBytes(parentNode), hexToBytes(labelHash)]))
}

// --- JSON-RPC helpers -------------------------------------------------------

interface RpcReadCall {
  readonly method: string
  readonly params: unknown[]
}

interface RpcBatchResponse {
  readonly id?: number
  readonly result?: unknown
  readonly error?: { readonly message?: string }
}

interface RpcBatchRequest extends RpcReadCall {
  readonly jsonrpc: '2.0'
  readonly id: number
}

const RPC_READ_BATCH_SIZE = 100

export async function rpcCall(
  endpoint: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}: ${res.statusText}`)
  const json = (await res.json()) as {
    result?: unknown
    error?: { message: string }
  }
  if (json.error) throw new Error(`RPC error: ${json.error.message}`)
  return json.result
}

/**
 * Send read-only JSON-RPC calls in bounded batches. Batch responses may arrive
 * in any order, so results are restored to input order by request id. If an RPC
 * endpoint does not support batching, retry that chunk as individual reads;
 * per-call failures stay `undefined` for the caller's existing fallback.
 */
async function fetchRpcReadBatch(
  endpoint: string,
  requests: readonly RpcBatchRequest[],
): Promise<RpcBatchResponse[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requests),
  })
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}: ${res.statusText}`)
  const json: unknown = await res.json()
  if (!Array.isArray(json))
    throw new Error('RPC batch response is not an array')
  return json as RpcBatchResponse[]
}

async function retryRpcReadChunk(
  endpoint: string,
  chunk: readonly RpcReadCall[],
  results: (unknown | undefined)[],
  offset: number,
): Promise<void> {
  for (const [index, call] of chunk.entries()) {
    try {
      results[offset + index] = await rpcCall(
        endpoint,
        call.method,
        call.params,
      )
    } catch {
      // Preserve the caller's per-name fallback for an unreadable entry.
    }
  }
}

function restoreRpcReadBatchOrder(
  responses: readonly RpcBatchResponse[],
  requests: readonly RpcBatchRequest[],
  results: (unknown | undefined)[],
  offset: number,
): void {
  const responsesById = new Map(
    responses.flatMap((response) =>
      typeof response.id === 'number' ? [[response.id, response] as const] : [],
    ),
  )
  for (const [index, request] of requests.entries()) {
    const response = responsesById.get(request.id)
    if (response && !response.error) results[offset + index] = response.result
  }
}

async function rpcReadBatch(
  endpoint: string,
  calls: readonly RpcReadCall[],
): Promise<(unknown | undefined)[]> {
  const results = new Array<unknown | undefined>(calls.length).fill(undefined)

  for (let offset = 0; offset < calls.length; offset += RPC_READ_BATCH_SIZE) {
    const chunk = calls.slice(offset, offset + RPC_READ_BATCH_SIZE)
    const requests: RpcBatchRequest[] = chunk.map((call, index) => ({
      jsonrpc: '2.0' as const,
      id: offset + index + 1,
      method: call.method,
      params: call.params,
    }))

    try {
      const responses = await fetchRpcReadBatch(endpoint, requests)
      restoreRpcReadBatchOrder(responses, requests, results, offset)
    } catch {
      await retryRpcReadChunk(endpoint, chunk, results, offset)
    }
  }

  return results
}

export async function sendTx(
  endpoint: string,
  to: string,
  data: `0x${string}`,
  value = '0x0',
): Promise<void> {
  await rpcCall(endpoint, 'eth_sendTransaction', [
    {
      from: DEFAULT_ACCOUNT,
      to,
      data,
      gas: '0x7A120', // 500 000 gas
      gasPrice: '0x3B9ACA00', // 1 gwei — override fork base fee
      value,
    },
  ])
  await rpcCall(endpoint, 'evm_mine', [])
}

export async function increaseTime(
  endpoint: string,
  seconds: number,
): Promise<void> {
  await rpcCall(endpoint, 'evm_increaseTime', [seconds])
  await rpcCall(endpoint, 'evm_mine', [])
}

export async function getBlockTimestamp(endpoint: string): Promise<number> {
  const block = (await rpcCall(endpoint, 'eth_getBlockByNumber', [
    'latest',
    false,
  ])) as { timestamp: string }
  return Number.parseInt(block.timestamp, 16)
}

// Variant of sendTx that uses a custom `from` (for impersonated accounts).
// Funds the sender with 0.1 ETH first so the gas cost is covered even if the
// impersonated account has zero balance on the fork.
export async function sendTxFrom(
  endpoint: string,
  from: string,
  to: string,
  data: `0x${string}`,
): Promise<void> {
  await rpcCall(endpoint, 'anvil_setBalance', [from, '0x16345785D8A0000']) // 0.1 ETH
  await rpcCall(endpoint, 'eth_sendTransaction', [
    { from, to, data, gas: '0xF4240', gasPrice: '0x3B9ACA00' },
  ])
  await rpcCall(endpoint, 'evm_mine', [])
}

// --- Name creation ----------------------------------------------------------

/**
 * Register a V1 .eth name by calling BaseRegistrar.register() directly.
 * DEFAULT_ACCOUNT must already be an authorized controller on the BaseRegistrar —
 * ensureFunded() does this via impersonation on each Anvil session.
 */
export async function registerV1Name(
  endpoint: string,
  label: string,
  wrapAfterRegister: boolean,
): Promise<void> {
  const tokenId = BigInt(labelhash(label))

  await sendTx(
    endpoint,
    V1_BASE_REGISTRAR,
    encodeFunctionData({
      abi: baseRegistrarRegisterSnippet,
      functionName: 'register',
      args: [tokenId, DEFAULT_ACCOUNT, BigInt(ONE_YEAR)],
    }),
  )

  if (!wrapAfterRegister) return

  // Approve the NameWrapper to transfer the ERC-721
  await sendTx(
    endpoint,
    V1_BASE_REGISTRAR,
    encodeFunctionData({
      abi: registrySetApprovalForAllSnippet,
      functionName: 'setApprovalForAll',
      args: [V1_NAME_WRAPPER, true],
    }),
  )

  // Wrap via official NameWrapper (pass zero resolver — not needed for migration testing)
  await sendTx(
    endpoint,
    V1_NAME_WRAPPER,
    encodeFunctionData({
      abi: nameWrapperWrapEth2ldSnippet,
      functionName: 'wrapETH2LD',
      args: [label, DEFAULT_ACCOUNT, 0, ZERO_ADDRESS],
    }),
  )
}

export async function setNameFuses(
  endpoint: string,
  label: string,
  fuses: number,
): Promise<void> {
  const lh = labelhash(label)
  const node = namehashFromLabelAndParent(lh, ETH_NODE)
  await sendTx(
    endpoint,
    V1_NAME_WRAPPER,
    encodeFunctionData({
      abi: nameWrapperSetFusesSnippet,
      functionName: 'setFuses',
      args: [node, fuses],
    }),
  )
}

export async function createEmancipatedSubname(
  endpoint: string,
  parentLabel: string,
  sublabel: string,
): Promise<void> {
  const parentLh = labelhash(parentLabel)
  const parentNode = namehashFromLabelAndParent(parentLh, ETH_NODE)
  const now = await getBlockTimestamp(endpoint)
  const expiry = BigInt(now + ONE_YEAR * 2)
  const subFuses = PARENT_CANNOT_CONTROL | CANNOT_UNWRAP

  await sendTx(
    endpoint,
    V1_NAME_WRAPPER,
    encodeFunctionData({
      abi: nameWrapperSetSubnodeOwnerSnippet,
      functionName: 'setSubnodeOwner',
      args: [parentNode, sublabel, DEFAULT_ACCOUNT, subFuses, expiry],
    }),
  )
}

/** Read the live BaseRegistrar `owner()` off the fork; null if the call fails. */
export async function readRegistrarOwner(
  endpoint: string,
): Promise<`0x${string}` | null> {
  try {
    const result = (await rpcCall(endpoint, 'eth_call', [
      {
        to: V1_BASE_REGISTRAR,
        data: encodeFunctionData({
          abi: baseRegistrarOwnerSnippet,
          functionName: 'owner',
        }),
      },
      'latest',
    ])) as string
    if (typeof result !== 'string' || result.length < 66) return null
    return `0x${result.slice(-40)}` as `0x${string}`
  } catch {
    return null
  }
}

/** True if `account` is an authorized controller on the BaseRegistrar. */
export async function isController(
  endpoint: string,
  account: string,
): Promise<boolean> {
  try {
    const result = (await rpcCall(endpoint, 'eth_call', [
      {
        to: V1_BASE_REGISTRAR,
        data: encodeFunctionData({
          abi: baseRegistrarControllersSnippet,
          functionName: 'controllers',
          args: [account as `0x${string}`],
        }),
      },
      'latest',
    ])) as string
    return typeof result === 'string' && /[1-9a-f]/.test(result.slice(2))
  } catch {
    return false
  }
}

/**
 * Ensure DEFAULT_ACCOUNT is ready: fund it, clear any EOF contract code, and
 * re-authorize it as a controller on the official BaseRegistrar.
 *
 * ENS revoked all V1 controllers at ~block 10927919 as part of the V2 migration
 * cutover, so on a fresh Anvil fork no one can call BaseRegistrar.register().
 * We fix this by impersonating the BaseRegistrar owner and calling addController().
 *
 * The owner is read live off the fork (`owner()`) rather than hardcoded: it was
 * transferred on Sepolia, and impersonating a stale owner makes `addController`
 * revert silently, so DEFAULT_ACCOUNT never becomes a controller and every
 * `register()` reverts — producing phantom names that exist only in the
 * subgraph mock. We verify the grant landed and throw loudly if it didn't.
 */
export async function ensureFunded(endpoint: string): Promise<void> {
  const TARGET = '0x56BC75E2D63100000' // 100 ETH in wei
  // Clear EOF code so Anvil treats the account as a plain EOA
  await rpcCall(endpoint, 'anvil_setCode', [DEFAULT_ACCOUNT, '0x'])
  await rpcCall(endpoint, 'anvil_setBalance', [DEFAULT_ACCOUNT, TARGET])
  const actual = (await rpcCall(endpoint, 'eth_getBalance', [
    DEFAULT_ACCOUNT,
    'latest',
  ])) as string
  if (BigInt(actual) < BigInt('0x16345785D8A0000') /* 0.1 ETH */) {
    throw new Error(
      `anvil_setBalance did not work — balance is ${actual} (hex). Try running fund-account.sh manually.`,
    )
  }

  if (!(await isController(endpoint, DEFAULT_ACCOUNT))) {
    // Read the LIVE registrar owner off the fork — it has been transferred on
    // Sepolia, so the hardcoded constant is only a fallback if the read fails.
    const registrarOwner =
      (await readRegistrarOwner(endpoint)) ?? V1_BASE_REGISTRAR_OWNER

    // Impersonate the BaseRegistrar owner to re-authorize DEFAULT_ACCOUNT as a controller
    await rpcCall(endpoint, 'anvil_impersonateAccount', [registrarOwner])
    try {
      await sendTxFrom(
        endpoint,
        registrarOwner,
        V1_BASE_REGISTRAR,
        encodeFunctionData({
          abi: baseRegistrarAddControllerSnippet,
          functionName: 'addController',
          args: [DEFAULT_ACCOUNT],
        }),
      )
    } finally {
      await rpcCall(endpoint, 'anvil_stopImpersonatingAccount', [
        registrarOwner,
      ])
    }

    // Anvil includes reverted impersonated txs without throwing, so verify the
    // grant actually landed rather than trusting the send. If it didn't, the
    // owner we impersonated is wrong for this fork — fail loudly instead of
    // silently registering phantom names later.
    if (!(await isController(endpoint, DEFAULT_ACCOUNT))) {
      throw new Error(
        `Failed to authorize ${DEFAULT_ACCOUNT} as a BaseRegistrar controller ` +
          `(impersonated owner ${registrarOwner}). The registrar owner on this ` +
          `fork may have changed again — check BaseRegistrar.owner().`,
      )
    }
  }

  // This must run even when the V1 controller grant already exists: Anvil and
  // the names cookie can survive a deployment-address update during HMR.
  await ensureV2MigrationControllerRoles(endpoint)
}

const ROOT_RESOURCE = 0n
const V2_ROLES_STORAGE_SLOT = 2n
const ROLE_REGISTER_RESERVED = 1n << 4n

const V2_ROOT_ROLES_SLOT = keccak256(
  encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }],
    [ROOT_RESOURCE, V2_ROLES_STORAGE_SLOT],
  ),
)

function v2ControllerRoleStorageSlot(account: Address): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'bytes32' }],
      [account, V2_ROOT_ROLES_SLOT],
    ),
  )
}

/** Ensure both migration controllers can register reserved names on the fork. */
async function ensureV2MigrationControllerRoles(
  endpoint: string,
): Promise<void> {
  for (const controller of V2_MIGRATION_CONTROLLERS) {
    const storageSlot = v2ControllerRoleStorageSlot(controller)
    const stored = await rpcCall(endpoint, 'eth_getStorageAt', [
      V2_ETH_REGISTRY_ADDR,
      storageSlot,
      'latest',
    ])
    if (typeof stored !== 'string' || !stored.startsWith('0x')) {
      throw new Error(
        `Unable to read V2 roles for migration controller ${controller}`,
      )
    }

    const roles = BigInt(stored)
    const rolesWithReservedRegistration = roles | ROLE_REGISTER_RESERVED
    if (rolesWithReservedRegistration === roles) continue

    await rpcCall(endpoint, 'anvil_setStorageAt', [
      V2_ETH_REGISTRY_ADDR,
      storageSlot,
      toHex(rolesWithReservedRegistration, { size: 32 }),
    ])
  }
}

/**
 * Create a RESERVED slot in the V2 ETH registry for a name by impersonating
 * the ETH_REGISTRAR account (which holds ROLE_REGISTRAR on the registry).
 * Skips silently if the slot is already reserved.
 * For grace-period names (expiryDate in the past), also skips — those slots
 * would immediately be AVAILABLE and migration controllers can't use them.
 */
export async function reserveInV2(
  endpoint: string,
  label: string,
  expiryDate: number,
): Promise<void> {
  const now = await getBlockTimestamp(endpoint)
  if (expiryDate <= now) return // expired slot = AVAILABLE, controllers can't migrate
  const currentStatus = await getV2NameStatus(endpoint, label)
  if (currentStatus === V2_NAME_STATUS.RESERVED) return
  if (currentStatus === V2_NAME_STATUS.REGISTERED) return
  if (currentStatus !== V2_NAME_STATUS.AVAILABLE) {
    throw new Error(`Unable to read the V2 registry status for ${label}.eth`)
  }

  await reserveKnownAvailableNameInV2(endpoint, label, expiryDate)
}

async function reserveKnownAvailableNameInV2(
  endpoint: string,
  label: string,
  expiryDate: number,
): Promise<void> {
  await rpcCall(endpoint, 'anvil_impersonateAccount', [V2_ETH_REGISTRAR_ADDR])
  try {
    const data = encodeFunctionData({
      abi: userRegistryRegisterSnippet,
      functionName: 'register',
      args: [
        label,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        V1_PUBLIC_RESOLVER,
        0n,
        BigInt(expiryDate),
      ],
    })
    await sendTxFrom(
      endpoint,
      V2_ETH_REGISTRAR_ADDR,
      V2_ETH_REGISTRY_ADDR,
      data,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (
      !msg.includes('LabelAlreadyReserved') &&
      !msg.includes('AlreadyRegistered')
    )
      throw err
  } finally {
    await rpcCall(endpoint, 'anvil_stopImpersonatingAccount', [
      V2_ETH_REGISTRAR_ADDR,
    ])
  }

  const updatedStatus = await getV2NameStatus(endpoint, label)
  if (
    updatedStatus !== V2_NAME_STATUS.RESERVED &&
    updatedStatus !== V2_NAME_STATUS.REGISTERED
  ) {
    throw new Error(
      `Failed to reserve ${label}.eth in the active V2 registry (status ${String(updatedStatus)})`,
    )
  }
}

/**
 * Top-level dispatch — creates the V1 name on Anvil, reserves it in V2,
 * and returns { label, expiryDate } for the active names list.
 */
export async function createV1NameOnAnvil(
  endpoint: string,
  label: string,
  type: PresetType,
): Promise<{ label: string; expiryDate: number }> {
  await ensureFunded(endpoint)
  switch (type) {
    case 'unwrapped': {
      await registerV1Name(endpoint, label, false)
      const ts = await getBlockTimestamp(endpoint)
      const expiryDate = ts + ONE_YEAR
      await reserveInV2(endpoint, label, expiryDate)
      return { label, expiryDate }
    }
    case 'wrapped': {
      await registerV1Name(endpoint, label, true)
      const ts = await getBlockTimestamp(endpoint)
      const expiryDate = ts + ONE_YEAR
      await reserveInV2(endpoint, label, expiryDate)
      return { label, expiryDate }
    }
    case 'locked': {
      await registerV1Name(endpoint, label, true)
      await setNameFuses(endpoint, label, CANNOT_UNWRAP)
      const ts = await getBlockTimestamp(endpoint)
      const expiryDate = ts + ONE_YEAR
      await reserveInV2(endpoint, label, expiryDate)
      return { label, expiryDate }
    }
    case 'locked-all': {
      await registerV1Name(endpoint, label, true)
      await setNameFuses(endpoint, label, ALL_CHILD_FUSES)
      const ts = await getBlockTimestamp(endpoint)
      const expiryDate = ts + ONE_YEAR
      await reserveInV2(endpoint, label, expiryDate)
      return { label, expiryDate }
    }
    case 'grace': {
      await registerV1Name(endpoint, label, true)
      await setNameFuses(endpoint, label, CANNOT_UNWRAP)
      const ts = await getBlockTimestamp(endpoint)
      const expiryDate = ts
      await increaseTime(endpoint, ONE_YEAR + 45 * 86_400)
      return { label, expiryDate }
    }
    case 'grace-renewable-wrapped': {
      // Like `grace` (v1 name pushed 45 days into its 90-day grace window), but
      // the v2 slot is RESERVED with an expiry that OUTLASTS the v1 expiry.
      // `ETHRenewerV1.isRenewable` gates on the v2 reservation, not the v1 grace
      // clock, so this is the only state that is BOTH in-grace AND renewable.
      // WRAPPED variant: renewal extends the BaseRegistrar but NOT the
      // NameWrapper's stored expiry, so after renewal the ERC-1155 token stays
      // expired and migration reverts (ERC1155 insufficient balance) — use this
      // to reproduce that; use the unwrapped variant for the migrate happy-path.
      await registerV1Name(endpoint, label, true)
      await setNameFuses(endpoint, label, CANNOT_UNWRAP)
      const ts = await getBlockTimestamp(endpoint)
      const expiryDate = ts + ONE_YEAR // true v1 expiry (in the past after the advance below)
      // Reserve at v1 expiry + bonus, exactly as production pre-migration does, so
      // the renewable window is the real 90 days (not indefinite).
      await reserveInV2(endpoint, label, expiryDate + PREMIGRATION_BONUS_PERIOD)
      await increaseTime(endpoint, ONE_YEAR + 45 * 86_400)
      return { label, expiryDate }
    }
    case 'grace-renewable-unwrapped': {
      // Unwrapped counterpart of `grace-renewable-wrapped`: renewable in grace
      // (v2 reservation outlasts the v1 expiry) but held directly as the ERC-721
      // in the BaseRegistrar — so renewal revives the same token migration
      // transfers, and renew→migrate completes end-to-end.
      await registerV1Name(endpoint, label, false)
      const ts = await getBlockTimestamp(endpoint)
      const expiryDate = ts + ONE_YEAR
      // Reserve at v1 expiry + bonus, matching production pre-migration.
      await reserveInV2(endpoint, label, expiryDate + PREMIGRATION_BONUS_PERIOD)
      await increaseTime(endpoint, ONE_YEAR + 45 * 86_400)
      return { label, expiryDate }
    }
    case 'emancipated': {
      const sublabel = `sub-${label}`
      await registerV1Name(endpoint, label, true)
      await setNameFuses(endpoint, label, CANNOT_UNWRAP)
      await createEmancipatedSubname(endpoint, label, sublabel)
      const ts = await getBlockTimestamp(endpoint)
      const expiryDate = ts + ONE_YEAR
      await reserveInV2(endpoint, label, expiryDate)
      return { label, expiryDate }
    }
  }
}

// --- Subgraph mock ----------------------------------------------------------

/**
 * Build a minimal V1 subgraph domain object for a panel-created name.
 * Injected into getNamesForAddress responses so the migration UI finds the name.
 */
export function buildMockDomain(name: ActiveName): unknown {
  const lh = labelhash(name.label)
  const node = namehashFromLabelAndParent(lh, ETH_NODE)
  const isWrapped =
    name.type !== 'unwrapped' && name.type !== 'grace-renewable-unwrapped'
  const owner = DEFAULT_ACCOUNT.toLowerCase()
  const now = Math.floor(Date.now() / 1000)

  let fuses = PARENT_CANNOT_CONTROL | IS_DOT_ETH
  if (name.type !== 'unwrapped' && name.type !== 'wrapped')
    fuses |= CANNOT_UNWRAP
  if (name.type === 'locked-all') fuses |= ALL_CHILD_FUSES

  return {
    id: node,
    labelName: name.label,
    labelhash: lh,
    name: `${name.label}.eth`,
    isMigrated: false,
    createdAt: String(now - 3600),
    resolvedAddress: null,
    resolver: isWrapped
      ? { id: V1_PUBLIC_RESOLVER, address: V1_PUBLIC_RESOLVER }
      : null,
    owner: { id: isWrapped ? V1_NAME_WRAPPER.toLowerCase() : owner },
    registrant: { id: owner },
    wrappedOwner: isWrapped ? { id: owner } : null,
    parent: { name: 'eth', id: ETH_NODE, wrappedDomain: null },
    registration: {
      registrationDate: String(now - 3600),
      expiryDate: String(name.expiryDate),
    },
    wrappedDomain: isWrapped
      ? { expiryDate: String(name.expiryDate), fuses }
      : null,
  }
}

// --- Anvil on-chain sync helpers --------------------------------------------

const V2_NAME_STATUS = {
  AVAILABLE: 0,
  RESERVED: 1,
  REGISTERED: 2,
} as const

const V2_GET_STATUS_ABI = [
  {
    type: 'function',
    name: 'getStatus',
    stateMutability: 'view',
    inputs: [{ name: 'anyId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

function baseRegistrarReadCall(
  selector: `0x${string}`,
  label: string,
): RpcReadCall {
  const tokenIdPadded = labelhash(label).slice(2).padStart(64, '0')
  return {
    method: 'eth_call',
    params: [
      { to: V1_BASE_REGISTRAR, data: `${selector}${tokenIdPadded}` },
      'latest',
    ],
  }
}

function v2StatusReadCall(label: string): RpcReadCall {
  return {
    method: 'eth_call',
    params: [
      {
        to: V2_ETH_REGISTRY_ADDR,
        data: encodeFunctionData({
          abi: V2_GET_STATUS_ABI,
          functionName: 'getStatus',
          args: [BigInt(labelhash(label))],
        }),
      },
      'latest',
    ],
  }
}

function decodeV2NameStatus(result: unknown): number | null {
  try {
    if (typeof result !== 'string' || result === '0x') return null
    return Number(BigInt(result))
  } catch {
    return null
  }
}

async function getV2NameStatuses(
  endpoint: string,
  labels: readonly string[],
): Promise<(number | null)[]> {
  const results = await rpcReadBatch(
    endpoint,
    labels.map((label) => v2StatusReadCall(label)),
  )
  return results.map(decodeV2NameStatus)
}

async function getV2NameStatus(
  endpoint: string,
  label: string,
): Promise<number | null> {
  return (await getV2NameStatuses(endpoint, [label]))[0] ?? null
}

/**
 * Returns true if the .eth label is registered in the official BaseRegistrar on
 * the Anvil fork (ownerOf returns a non-zero address). This is the same
 * contract preflightChecks.ts uses for eligibility, so alignment is critical.
 */
export async function isNameOnAnvil(
  endpoint: string,
  label: string,
): Promise<boolean> {
  return (await getNamesOnAnvil(endpoint, [label]))[0] ?? false
}

/** Read V1 registration existence in bounded JSON-RPC batches. */
export async function getNamesOnAnvil(
  endpoint: string,
  labels: readonly string[],
): Promise<boolean[]> {
  const results = await rpcReadBatch(
    endpoint,
    labels.map((label) => baseRegistrarReadCall('0x6352211e', label)),
  )
  return results.map(
    (result) =>
      typeof result === 'string' && result.length > 2 && result !== '0x',
  )
}

/**
 * Live BaseRegistrar expiry (unix seconds) for a .eth label on the Anvil fork,
 * or null if unregistered/unreadable. The panel stores each name's expiryDate at
 * creation, which goes STALE after an in-app renewal (or time-travel) — and the
 * subgraph mock feeds `registration.expiryDate` into migration eligibility
 * (`classifyName` → `hasExpiredDotEthRegistration`). Reading it live keeps the
 * mock in step with on-chain state so a renewed grace name correctly becomes
 * migratable instead of staying classified `expired-registration`.
 */
export async function getOnchainExpiry(
  endpoint: string,
  label: string,
): Promise<number | null> {
  return (await getOnchainExpiries(endpoint, [label]))[0] ?? null
}

/** Read live BaseRegistrar expiries in bounded JSON-RPC batches. */
export async function getOnchainExpiries(
  endpoint: string,
  labels: readonly string[],
): Promise<(number | null)[]> {
  const results = await rpcReadBatch(
    endpoint,
    labels.map((label) => baseRegistrarReadCall('0xd6e4fa86', label)),
  )
  return results.map((result) => {
    try {
      if (typeof result !== 'string' || result === '0x') return null
      const expiry = Number(BigInt(result))
      return expiry > 0 ? expiry : null
    } catch {
      return null
    }
  })
}

function fixtureReservationExpiry(name: ActiveName): number | null {
  if (name.type === 'grace') return null
  if (
    name.type === 'grace-renewable-wrapped' ||
    name.type === 'grace-renewable-unwrapped'
  ) {
    return name.expiryDate + PREMIGRATION_BONUS_PERIOD
  }
  return name.expiryDate
}

interface ExistingFixtureReservation {
  readonly nameIndex: number
  readonly label: string
  readonly expiryDate: number
}

async function getExistingFixtureReservationStatuses(
  endpoint: string,
  names: readonly ActiveName[],
  existingNames: readonly boolean[],
): Promise<
  Map<number, ExistingFixtureReservation & { readonly status: number | null }>
> {
  const candidates = names.flatMap((name, nameIndex) => {
    if (!existingNames[nameIndex]) return []
    const expiryDate = fixtureReservationExpiry(name)
    return expiryDate == null
      ? []
      : [{ nameIndex, label: name.label, expiryDate }]
  })
  if (candidates.length === 0) return new Map()

  const now = await getBlockTimestamp(endpoint)
  const activeCandidates = candidates.filter(
    ({ expiryDate }) => expiryDate > now,
  )
  const statuses = await getV2NameStatuses(
    endpoint,
    activeCandidates.map(({ label }) => label),
  )

  return new Map(
    activeCandidates.map((candidate, index) => [
      candidate.nameIndex,
      { ...candidate, status: statuses[index] ?? null },
    ]),
  )
}

async function ensureExistingFixtureReservation(
  endpoint: string,
  reservation: ExistingFixtureReservation & { readonly status: number | null },
): Promise<void> {
  if (reservation.status === V2_NAME_STATUS.RESERVED) return
  if (reservation.status === V2_NAME_STATUS.REGISTERED) return
  if (reservation.status !== V2_NAME_STATUS.AVAILABLE) {
    throw new Error(
      `Unable to read the V2 registry status for ${reservation.label}.eth`,
    )
  }
  await reserveKnownAvailableNameInV2(
    endpoint,
    reservation.label,
    reservation.expiryDate,
  )
}

/**
 * For any active names missing from the Anvil fork (fork was reset), re-create
 * them and return an updated list with fresh expiryDates.
 */
export async function ensureNamesOnAnvil(
  endpoint: string,
  names: ActiveName[],
): Promise<ActiveName[]> {
  const result: ActiveName[] = []
  const existingNames = await getNamesOnAnvil(
    endpoint,
    names.map((name) => name.label),
  )

  if (existingNames.some(Boolean))
    await ensureV2MigrationControllerRoles(endpoint)

  const existingReservations = await getExistingFixtureReservationStatuses(
    endpoint,
    names,
    existingNames,
  )

  for (const [index, name] of names.entries()) {
    const exists = existingNames[index] ?? false
    if (exists) {
      const reservation = existingReservations.get(index)
      if (reservation)
        await ensureExistingFixtureReservation(endpoint, reservation)
      result.push(name)
    } else {
      const { label, expiryDate } = await createV1NameOnAnvil(
        endpoint,
        name.label,
        name.type,
      )
      result.push({ ...name, label, expiryDate })
    }
  }
  return result
}

// --- localStorage helpers ---------------------------------------------------

// Panel-created names are persisted in a COOKIE rather than localStorage so the
// list is shared across the portal (:3001) and manager (:3000) dev servers —
// cookies are scoped by host, not port, whereas localStorage is per-origin.
// This lets the subgraph mock in one app inject names created in the other,
// which is required for the manager migration list to see portal-created names.
// Cookie-safe name (no colons — those are separators the cookie grammar
// disallows in a name, even though some browsers tolerate them).
const NAMES_COOKIE_NAME = 'ens_migration_tool_v1_names'
const NAMES_COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function readNamesCookie(): string | null {
  const prefix = `${NAMES_COOKIE_NAME}=`
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix))
      return decodeURIComponent(part.slice(prefix.length))
  }
  return null
}

export function readStoredNames(): ActiveName[] {
  try {
    const raw = readNamesCookie()
    if (!raw) return []
    return JSON.parse(raw) as ActiveName[]
  } catch {
    return []
  }
}

export function writeStoredNames(names: ActiveName[]): void {
  try {
    // No domain attribute → defaults to the current host (localhost), shared
    // across ports. SameSite=Lax keeps it same-site only.
    const value = encodeURIComponent(JSON.stringify(names))
    document.cookie = `${NAMES_COOKIE_NAME}=${value}; path=/; max-age=${NAMES_COOKIE_MAX_AGE}; SameSite=Lax`
  } catch {
    /* storage disabled */
  }
}

export function readStoredPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Pos>
    if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
      return { left: parsed.left, top: parsed.top }
    }
    return null
  } catch {
    return null
  }
}

export function clampPos(pos: Pos, el: HTMLElement | null): Pos {
  if (typeof window === 'undefined') return pos
  const width = el?.offsetWidth ?? 280
  const height = el?.offsetHeight ?? 320
  const maxLeft = Math.max(4, window.innerWidth - width - 4)
  const maxTop = Math.max(4, window.innerHeight - height - 4)
  return {
    left: Math.min(Math.max(4, pos.left), maxLeft),
    top: Math.min(Math.max(4, pos.top), maxTop),
  }
}
