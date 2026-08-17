/**
 * Resolver EAC role definitions.
 * Same nybble-packed bitmap format as registry roles, but with
 * resolver-specific meanings at each bit position.
 *
 * Bit positions (manager):
 *   1 << 0   ROLE_SET_ADDR
 *   1 << 4   ROLE_SET_TEXT
 *   1 << 8   ROLE_SET_CONTENTHASH
 *   1 << 12  ROLE_SET_PUBKEY
 *   1 << 16  ROLE_SET_ABI
 *   1 << 20  ROLE_SET_INTERFACE
 *   1 << 24  ROLE_SET_NAME
 *   1 << 28  ROLE_SET_ALIAS
 *   1 << 32  ROLE_CLEAR
 *   1 << 124 ROLE_UPGRADE
 *
 * Admin bits are at position + 128.
 */

import { encodePacked, keccak256 } from 'viem'
import { namehash } from 'viem/ens'

export const resolverRoles = {
  ROLE_SET_ADDR: 1n << 0n,
  ROLE_SET_ADDR_ADMIN: (1n << 0n) << 128n,
  ROLE_SET_TEXT: 1n << 4n,
  ROLE_SET_TEXT_ADMIN: (1n << 4n) << 128n,
  ROLE_SET_CONTENTHASH: 1n << 8n,
  ROLE_SET_CONTENTHASH_ADMIN: (1n << 8n) << 128n,
  ROLE_SET_PUBKEY: 1n << 12n,
  ROLE_SET_PUBKEY_ADMIN: (1n << 12n) << 128n,
  ROLE_SET_ABI: 1n << 16n,
  ROLE_SET_ABI_ADMIN: (1n << 16n) << 128n,
  ROLE_SET_INTERFACE: 1n << 20n,
  ROLE_SET_INTERFACE_ADMIN: (1n << 20n) << 128n,
  ROLE_SET_NAME: 1n << 24n,
  ROLE_SET_NAME_ADMIN: (1n << 24n) << 128n,
  ROLE_SET_ALIAS: 1n << 28n,
  ROLE_SET_ALIAS_ADMIN: (1n << 28n) << 128n,
  ROLE_CLEAR: 1n << 32n,
  ROLE_CLEAR_ADMIN: (1n << 32n) << 128n,
  ROLE_UPGRADE: 1n << 124n,
  ROLE_UPGRADE_ADMIN: (1n << 124n) << 128n,
} as const

export type ResolverRoleKey = keyof typeof resolverRoles

type ResolverPermissionKey = Exclude<ResolverRoleKey, `${string}_ADMIN`>

type ResolverPermission = {
  key: ResolverPermissionKey
  title: string
  description: string
}

export const resolverPermissions: ResolverPermission[] = [
  {
    key: 'ROLE_SET_ADDR',
    title: 'Set Address',
    description: 'Can set address records',
  },
  {
    key: 'ROLE_SET_TEXT',
    title: 'Set Text',
    description: 'Can set text records',
  },
  {
    key: 'ROLE_SET_CONTENTHASH',
    title: 'Set Content Hash',
    description: 'Can set content hash records',
  },
  {
    key: 'ROLE_SET_PUBKEY',
    title: 'Set Pubkey',
    description: 'Can set public key records',
  },
  {
    key: 'ROLE_SET_ABI',
    title: 'Set ABI',
    description: 'Can set ABI records',
  },
  {
    key: 'ROLE_SET_INTERFACE',
    title: 'Set Interface',
    description: 'Can set interface implementer records',
  },
  {
    key: 'ROLE_SET_NAME',
    title: 'Set Name',
    description: 'Can set reverse name records',
  },
  {
    key: 'ROLE_SET_ALIAS',
    title: 'Set Alias',
    description: 'Can set alias mappings',
  },
  {
    key: 'ROLE_CLEAR',
    title: 'Clear',
    description: 'Can clear all versioned records',
  },
  {
    key: 'ROLE_UPGRADE',
    title: 'Upgrade',
    description: 'Can upgrade the resolver contract',
  },
]

/**
 * Decodes a resolver role bitmap into an array of role names.
 */
export const decodeResolverRoleBitmap = (
  bitmap: bigint | string,
): ResolverRoleKey[] => {
  const bitmapValue = typeof bitmap === 'string' ? BigInt(bitmap) : bitmap

  const roles: ResolverRoleKey[] = []

  for (const [roleName, roleValue] of Object.entries(resolverRoles)) {
    if ((bitmapValue & roleValue) !== 0n) {
      roles.push(roleName as ResolverRoleKey)
    }
  }

  return roles
}

const ROOT_RESOURCE =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

/**
 * Compute the EAC resource ID for a name (with part = 0).
 * Mirrors `PermissionedResolverLib.resource(node, 0)` in Solidity.
 */
export const computeNameResource = (name: string): string =>
  keccak256(
    encodePacked(['bytes32', 'bytes32'], [namehash(name), ZERO_BYTES32]),
  )

/**
 * Build a lookup map from resource hash → node name using the resolver's
 * node list. ROOT_RESOURCE maps to '(root)'.
 */
export const buildResourceToNameMap = (
  nodes: readonly { readonly name: string }[],
): Map<string, string> => {
  const map = new Map<string, string>()
  map.set(ROOT_RESOURCE, '(root)')

  for (const node of nodes) {
    if (node.name) {
      map.set(computeNameResource(node.name).toLowerCase(), node.name)
    }
  }

  return map
}

type RoleInput = {
  readonly account: string
  readonly resource: string
  readonly roleBitmap: string
}

export type AccountRoleGroup<T extends RoleInput = RoleInput> = {
  readonly account: string
  readonly resolvedNames: readonly string[]
  readonly roles: readonly T[]
  readonly decodedRoles: readonly string[]
}

/**
 * Groups resolver roles by account, decodes bitmaps, and resolves
 * resource hashes to human-readable names when possible.
 */
export const groupRolesByAccount = <T extends RoleInput>(
  roles: readonly T[],
  resourceToName?: Map<string, string>,
): AccountRoleGroup<T>[] => {
  const grouped = new Map<
    string,
    {
      account: string
      resolvedNames: Set<string>
      roles: T[]
      decodedRoles: string[]
    }
  >()

  for (const role of roles) {
    const account = role.account.toLowerCase()
    const resource = role.resource.toLowerCase()
    const decoded = decodeResolverRoleBitmap(role.roleBitmap)
    const resolvedName = resourceToName?.get(resource) ?? null

    const existing = grouped.get(account)

    if (existing) {
      existing.roles.push(role)
      existing.decodedRoles.push(...decoded)
      if (resolvedName) existing.resolvedNames.add(resolvedName)
    } else {
      const names = new Set<string>()
      if (resolvedName) names.add(resolvedName)
      grouped.set(account, {
        account,
        resolvedNames: names,
        roles: [role],
        decodedRoles: [...decoded],
      })
    }
  }

  return Array.from(grouped.values()).map((g) => ({
    ...g,
    resolvedNames: Array.from(g.resolvedNames),
  }))
}
