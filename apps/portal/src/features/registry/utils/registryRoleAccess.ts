/**
 * Pure helpers for reasoning about registry root-resource role assignments.
 *
 * All functions operate on the `RegistryRoleRow[]` returned by
 * `getRegistryRolesQueryOptions` (one row per account, listing the roles it
 * holds at the registry root, `_ADMIN` variants included). Kept pure and
 * framework-free so the add/edit-user sheets share them and they're unit-tested
 * in isolation.
 */

import type { Role } from '@ensdomains/ensjs/utils/v2'
import type { Address } from 'viem'
import type { RegistryRoleRow } from '../hooks/useRegistryRoles'

const ADMIN_SUFFIX = '_ADMIN'

export const isAdminRole = (role: Role): boolean => role.endsWith(ADMIN_SUFFIX)

/** The `_ADMIN` counterpart of a role (returns the role unchanged if already admin). */
export const toAdminRole = (role: Role): Role =>
  isAdminRole(role) ? role : (`${role}${ADMIN_SUFFIX}` as Role)

/** Roles held by `account` at the registry root (case-insensitive). */
const rolesForAccount = (
  rows: readonly RegistryRoleRow[] | undefined,
  account: Address | undefined,
): readonly Role[] => {
  if (!rows || !account) return []
  const target = account.toLowerCase()
  return rows.find((row) => row.account.toLowerCase() === target)?.roles ?? []
}

/** The `_ADMIN` roles `account` holds — i.e. the roles it can grant/revoke. */
export const getAccountAdminRoles = (
  rows: readonly RegistryRoleRow[] | undefined,
  account: Address | undefined,
): Set<Role> => new Set(rolesForAccount(rows, account).filter(isAdminRole))

/**
 * Subset of `currentRoles` whose `_ADMIN` counterpart is in `callerAdminRoles`
 * — i.e. the roles the caller is permitted to revoke.
 */
export const getRemovableRoles = (
  currentRoles: readonly Role[],
  callerAdminRoles: ReadonlySet<Role>,
): Role[] =>
  currentRoles.filter((role) => callerAdminRoles.has(toAdminRole(role)))

/**
 * The `_ADMIN` roles `account` is the *sole* holder of across `rows` — revoking
 * any of these removes the last admin for that role (a lockout).
 */
export const getSoleAdminRoles = (
  rows: readonly RegistryRoleRow[] | undefined,
  account: Address | undefined,
): Set<Role> => {
  if (!rows || !account) return new Set()
  const target = account.toLowerCase()
  const result = new Set<Role>()
  for (const role of rolesForAccount(rows, account)) {
    if (!isAdminRole(role)) continue
    const hasOtherHolder = rows.some(
      (row) => row.account.toLowerCase() !== target && row.roles.includes(role),
    )
    if (!hasOtherHolder) result.add(role)
  }
  return result
}

/** Roles to grant/revoke to move a holder from `current` to `selected`. */
export const computeRoleDiff = (
  current: ReadonlySet<Role>,
  selected: ReadonlySet<Role>,
): { toGrant: Role[]; toRevoke: Role[] } => {
  const toGrant: Role[] = []
  const toRevoke: Role[] = []
  for (const role of selected) if (!current.has(role)) toGrant.push(role)
  for (const role of current) if (!selected.has(role)) toRevoke.push(role)
  return { toGrant, toRevoke }
}
