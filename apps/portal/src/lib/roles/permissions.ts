/**
 * Permission definitions based on RegistryRolesLib contract constants
 * @see https://github.com/ensdomains/contracts-v2/blob/main/contracts/src/registry/libraries/RegistryRolesLib.sol
 */

import type { Role } from '@ensdomains/ensjs/utils/v2'

/** A role is an "admin" variant when it carries the `_ADMIN` suffix. */
export const isAdminRole = (role: string): boolean => role.endsWith('_ADMIN')

type PermissionKey = Exclude<Role, `${string}_ADMIN`>

type Permission = {
  key: PermissionKey
  title: string
  description: string
}

export const permissions: Permission[] = [
  {
    key: 'ROLE_RENEW',
    title: 'Renew',
    description: 'Can renew name registrations',
  },
  {
    key: 'ROLE_SET_SUBREGISTRY',
    title: 'Set Subregistry',
    description: 'Can change subregistry addresses',
  },
  {
    key: 'ROLE_SET_RESOLVER',
    title: 'Set Resolver',
    description: 'Can change the resolver addresses',
  },
  {
    key: 'ROLE_UNREGISTER',
    title: 'Unregister',
    description: 'Can unregister (delete) the name',
  },
] as const

const nonSettableManagerRoles = new Set<Role>(['ROLE_REGISTRAR', 'ROLE_RENEW'])

/**
 * The .eth registry rejects ROLE_UNREGISTER grants for 2LDs because only the
 * registrar is permitted to unregister .eth 2LDs. Disable it in the UI to
 * avoid a guaranteed revert at grant time.
 */
const nonSettableManagerRolesFor2LD = new Set<Role>(['ROLE_UNREGISTER'])

export type IsManagerRoleSettableContext = {
  is2LD?: boolean
}

export const isManagerRoleSettable = (
  role: Role,
  { is2LD = false }: IsManagerRoleSettableContext = {},
) => {
  if (nonSettableManagerRoles.has(role)) return false
  if (is2LD && nonSettableManagerRolesFor2LD.has(role)) return false
  return true
}

export type RegistryRootPermission = {
  readonly key: PermissionKey | null
  readonly adminKey: Role
  readonly title: string
  readonly description: string
}

export const registryRootPermissions: readonly RegistryRootPermission[] = [
  {
    key: 'ROLE_SET_SUBREGISTRY',
    adminKey: 'ROLE_SET_SUBREGISTRY_ADMIN',
    title: 'Set Subregistry',
    description: 'Can change subregistry addresses',
  },
  {
    key: 'ROLE_SET_RESOLVER',
    adminKey: 'ROLE_SET_RESOLVER_ADMIN',
    title: 'Set Resolver',
    description: 'Can change the resolver address',
  },
  {
    key: 'ROLE_RENEW',
    adminKey: 'ROLE_RENEW_ADMIN',
    title: 'Renew',
    description: 'Can extend name expiration',
  },
  {
    key: 'ROLE_REGISTRAR',
    adminKey: 'ROLE_REGISTRAR_ADMIN',
    title: 'Registrar',
    description: 'Can register new labels',
  },
  {
    key: 'ROLE_REGISTER_RESERVED',
    adminKey: 'ROLE_REGISTER_RESERVED_ADMIN',
    title: 'Register Reserved',
    description: 'Can register reserved labels',
  },
  {
    key: 'ROLE_SET_PARENT',
    adminKey: 'ROLE_SET_PARENT_ADMIN',
    title: 'Set Parent',
    description: 'Can update canonical parent',
  },
] as const
