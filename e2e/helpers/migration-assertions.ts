/**
 * Post-migration assertion helpers for V1→V2 migration tests.
 *
 * All assertions read V2 on-chain state directly via the Anvil publicClient,
 * bypassing the subgraph. This gives reliable ground-truth verification that
 * the migration transaction actually landed correctly in the V2 registry.
 */

import { expect } from '@playwright/test'
import { type Address, keccak256, parseAbi, toHex, zeroAddress } from 'viem'
import { publicClient } from './anvil-client.js'

// ---------------------------------------------------------------------------
// V2 Contract addresses
// ---------------------------------------------------------------------------
const V2_ETH_REGISTRY = '0x796fff2e907449be8d5921bcc215b1b76d89d080' as Address

const ETH_REGISTRY_ABI = parseAbi([
  // PermissionedRegistry read functions
  'function getStatus(uint256 anyId) view returns (uint8)',
  'function getSubregistry(string label) view returns (address)',
  'function getResolver(string label) view returns (address)',
  // Roles: returns bitmap of roles held by `account` on the given label's token resource
  'function roles(uint256 labelHash, address account) view returns (uint256)',
  // ERC-1155 ownership
  'function ownerOf(uint256 tokenId) view returns (address)',
])

// V2 registry status enum
export const V2Status = {
  AVAILABLE: 0,
  RESERVED: 1,
  REGISTERED: 2,
} as const

export type V2StatusValue = (typeof V2Status)[keyof typeof V2Status]

// ---------------------------------------------------------------------------
// Role bitmap constants (RegistryRolesLib)
// ---------------------------------------------------------------------------
export const REGISTRY_ROLES = {
  ROLE_REGISTRAR: 1n << 0n,
  ROLE_UNREGISTER: 1n << 1n,
  ROLE_RENEW: 1n << 2n,
  ROLE_SET_SUBREGISTRY: 1n << 3n,
  ROLE_SET_RESOLVER: 1n << 4n,
  ROLE_REGISTER_RESERVED: 1n << 5n,
  ROLE_SET_PARENT: 1n << 6n,
  ROLE_SET_URI: 1n << 7n,
  ROLE_UPGRADE: 1n << 8n,
  ROLE_CAN_TRANSFER_ADMIN: 1n << 9n,
  // Admin variants live at bit + 128
  ROLE_REGISTRAR_ADMIN: 1n << 128n,
  ROLE_UNREGISTER_ADMIN: 1n << 129n,
  ROLE_RENEW_ADMIN: 1n << 130n,
  ROLE_SET_RESOLVER_ADMIN: 1n << 132n,
  ROLE_CAN_TRANSFER_ADMIN_A: 1n << 137n,
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function labelHashBigInt(label: string): bigint {
  return BigInt(keccak256(toHex(label)))
}

async function readStatus(label: string): Promise<number> {
  const labelHash = labelHashBigInt(label)
  return publicClient.readContract({
    address: V2_ETH_REGISTRY,
    abi: ETH_REGISTRY_ABI,
    functionName: 'getStatus',
    args: [labelHash],
  })
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/**
 * Assert that the V2 ETH Registry shows the name as REGISTERED (status=2).
 * Call this as the first assertion after any migration flow.
 */
export async function assertV2Registered(label: string): Promise<void> {
  const status = await readStatus(label)
  expect(
    status,
    `Expected ${label}.eth to be REGISTERED (2) in V2, got status=${status}`,
  ).toBe(V2Status.REGISTERED)
}

/**
 * Assert that the V2 ETH Registry shows the name as RESERVED (status=1).
 * Useful for verifying the reserveInV2() step before migration.
 */
export async function assertV2Reserved(label: string): Promise<void> {
  const status = await readStatus(label)
  expect(
    status,
    `Expected ${label}.eth to be RESERVED (1) in V2, got status=${status}`,
  ).toBe(V2Status.RESERVED)
}

/**
 * Assert that a WrapperRegistry subregistry was created for a locked name.
 * The subregistry address should be non-zero after migration.
 */
export async function assertWrapperRegistryCreated(
  label: string,
): Promise<void> {
  const subregistry = await publicClient.readContract({
    address: V2_ETH_REGISTRY,
    abi: ETH_REGISTRY_ABI,
    functionName: 'getSubregistry',
    args: [label],
  })
  expect(
    subregistry,
    `Expected ${label}.eth to have a WrapperRegistry subregistry after locked migration`,
  ).not.toBe(zeroAddress)
}

/**
 * Assert that no subregistry exists (expected for unlocked/unwrapped migrations).
 */
export async function assertNoSubregistry(label: string): Promise<void> {
  const subregistry = await publicClient.readContract({
    address: V2_ETH_REGISTRY,
    abi: ETH_REGISTRY_ABI,
    functionName: 'getSubregistry',
    args: [label],
  })
  expect(
    subregistry,
    `Expected ${label}.eth to have no subregistry (unlocked/unwrapped migration)`,
  ).toBe(zeroAddress)
}

/**
 * Assert the V2 resolver for a label matches `expectedResolver`.
 * For names with records, this should be the V1 public resolver address
 * (records are preserved via resolver continuity, not re-written).
 */
export async function assertV2Resolver(
  label: string,
  expectedResolver: Address,
): Promise<void> {
  const resolver = await publicClient.readContract({
    address: V2_ETH_REGISTRY,
    abi: ETH_REGISTRY_ABI,
    functionName: 'getResolver',
    args: [label],
  })
  expect(
    resolver.toLowerCase(),
    `Expected ${label}.eth resolver to be ${expectedResolver}`,
  ).toBe(expectedResolver.toLowerCase())
}

/**
 * Assert that `account` has the given role bits set on `label`'s V2 token resource.
 * `expectedRoles` is a bigint bitmap (use REGISTRY_ROLES constants).
 *
 * Checks that every bit in `expectedRoles` is present in the actual bitmap;
 * does NOT require an exact match (other roles may also be set).
 */
export async function assertHasRoles(
  label: string,
  account: Address,
  expectedRoles: bigint,
): Promise<void> {
  const labelHash = labelHashBigInt(label)
  const actualBitmap = await publicClient.readContract({
    address: V2_ETH_REGISTRY,
    abi: ETH_REGISTRY_ABI,
    functionName: 'roles',
    args: [labelHash, account],
  })
  const missing = expectedRoles & ~actualBitmap
  expect(
    missing,
    `Account ${account} is missing roles 0x${missing.toString(16)} on ${label}.eth ` +
      `(actual=0x${actualBitmap.toString(16)}, expected=0x${expectedRoles.toString(16)})`,
  ).toBe(0n)
}

/**
 * Assert that `account` does NOT have specific role bits on `label`'s V2 token resource.
 */
export async function assertLacksRoles(
  label: string,
  account: Address,
  forbiddenRoles: bigint,
): Promise<void> {
  const labelHash = labelHashBigInt(label)
  const actualBitmap = await publicClient.readContract({
    address: V2_ETH_REGISTRY,
    abi: ETH_REGISTRY_ABI,
    functionName: 'roles',
    args: [labelHash, account],
  })
  const present = forbiddenRoles & actualBitmap
  expect(
    present,
    `Account ${account} unexpectedly has roles 0x${present.toString(16)} on ${label}.eth ` +
      `(actual=0x${actualBitmap.toString(16)})`,
  ).toBe(0n)
}

/**
 * Run all standard post-migration assertions for an unwrapped or unlocked name:
 * - REGISTERED in V2
 * - No WrapperRegistry subregistry
 */
export async function assertUnlockedMigration(label: string): Promise<void> {
  await assertV2Registered(label)
  await assertNoSubregistry(label)
}

/**
 * Run all standard post-migration assertions for a locked name:
 * - REGISTERED in V2
 * - WrapperRegistry created as subregistry
 */
export async function assertLockedMigration(label: string): Promise<void> {
  await assertV2Registered(label)
  await assertWrapperRegistryCreated(label)
}
