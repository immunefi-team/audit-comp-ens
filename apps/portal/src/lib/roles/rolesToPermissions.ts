import type { ResolverRole } from '@ensdomains/ensjs/public/v2'
import type { ResolverRoleKey } from './resolverRoles'

export type Permission = { readonly admin: boolean; readonly manager: boolean }

export type RoleChanges = {
  rolesToGrant: ResolverRole[]
  rolesToRevoke: ResolverRoleKey[]
}

export const roleToPermissions = (
  items: readonly string[],
): Map<string, Permission> => {
  const roles = new Map<string, Permission>()

  for (const item of items) {
    const adminPostfixIndex = item.indexOf('_ADMIN')
    if (adminPostfixIndex !== -1) {
      const base = item.slice(0, adminPostfixIndex)
      roles.set(base, {
        admin: true,
        manager: roles.get(base)?.manager || false,
      })
    } else {
      roles.set(item, {
        admin: roles.get(item)?.admin || false,
        manager: true,
      })
    }
  }

  return roles
}

export const hasPermissionsChanged = (
  original: Map<string, Permission>,
  edited: Map<string, Permission>,
): boolean => {
  // Check all keys in original
  for (const [key, originalPerm] of original) {
    const editedPerm = edited.get(key)
    if (
      !editedPerm ||
      originalPerm.admin !== editedPerm.admin ||
      originalPerm.manager !== editedPerm.manager
    ) {
      return true
    }
  }

  // Check if there are new permissions in edited that weren't in original
  for (const [key, editedPerm] of edited) {
    const originalPerm = original.get(key)
    if (
      !originalPerm ||
      originalPerm.admin !== editedPerm.admin ||
      originalPerm.manager !== editedPerm.manager
    ) {
      return true
    }
  }

  return false
}

export const computeRoleChanges = (
  originalRoles: string[],
  editedPermissions: Map<string, Permission>,
): RoleChanges => {
  const originalPermissions = roleToPermissions(originalRoles)
  const rolesToGrant: ResolverRole[] = []
  const rolesToRevoke: ResolverRoleKey[] = []

  // Check all permissions
  const allKeys = new Set([
    ...originalPermissions.keys(),
    ...editedPermissions.keys(),
  ])

  for (const key of allKeys) {
    const original = originalPermissions.get(key) || {
      admin: false,
      manager: false,
    }
    const edited = editedPermissions.get(key) || {
      admin: false,
      manager: false,
    }

    // Check for admin changes
    if (edited.admin && !original.admin) {
      rolesToGrant.push(`${key}_ADMIN` as ResolverRole)
    } else if (!edited.admin && original.admin) {
      rolesToRevoke.push(`${key}_ADMIN` as ResolverRoleKey)
    }

    // Check for manager changes
    if (edited.manager && !original.manager) {
      rolesToGrant.push(key as ResolverRole)
    } else if (!edited.manager && original.manager) {
      rolesToRevoke.push(key as ResolverRoleKey)
    }
  }

  return { rolesToGrant, rolesToRevoke }
}
