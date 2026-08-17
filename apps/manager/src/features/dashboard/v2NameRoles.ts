import type { DomainFragment } from '@ens-apps/indexer'
import type { DashboardNameRole, DashboardV2Name } from './mergedNames'
import { resolveDomainLabel } from './utils'

export type V2RoleAssignment = {
  readonly name: string | null
  readonly roleBitmap: string
}

const OWNER_ROLES = ['owner'] as const satisfies readonly DashboardNameRole[]
const MANAGER_ONLY_ROLES = [
  'manager',
] as const satisfies readonly DashboardNameRole[]
const OWNER_MANAGER_ROLES = [
  'owner',
  'manager',
] as const satisfies readonly DashboardNameRole[]

const normalizeName = (name: string | null | undefined): string | null =>
  name ? name.toLowerCase() : null

const bitmapToBigInt = (bitmap: string | undefined): bigint | null => {
  if (!bitmap) return null
  try {
    return BigInt(bitmap)
  } catch {
    return null
  }
}

const getRoleBitmapByName = (
  assignments: readonly V2RoleAssignment[],
): ReadonlyMap<string, string> => {
  const roleBitmapByName = new Map<string, string>()

  for (const assignment of assignments) {
    const name = normalizeName(assignment.name)
    if (!name) continue

    const existing = roleBitmapByName.get(name)
    const next = assignment.roleBitmap
    const nextValue = bitmapToBigInt(next)
    const existingValue = bitmapToBigInt(existing)

    if (
      nextValue !== null &&
      (existingValue === null || nextValue > existingValue)
    ) {
      roleBitmapByName.set(name, next)
    }
  }

  return roleBitmapByName
}

const hasNonZeroRoleBitmap = (bitmap: string | undefined): boolean => {
  const value = bitmapToBigInt(bitmap)
  return value !== null && value !== 0n
}

const hasRoleAssignment = (
  domain: DomainFragment,
  roleBitmapByName: ReadonlyMap<string, string>,
): boolean => {
  const names = [domain.normalizedName, domain.name]
    .map(normalizeName)
    .filter((name): name is string => !!name)

  return names.some((name) => hasNonZeroRoleBitmap(roleBitmapByName.get(name)))
}

export const applyV2RoleAssignments = (
  domains: readonly DomainFragment[],
  assignments: readonly V2RoleAssignment[],
): DashboardV2Name[] => {
  const roleBitmapByName = getRoleBitmapByName(assignments)

  return domains.map((domain) => ({
    ...domain,
    nameRoles: hasRoleAssignment(domain, roleBitmapByName)
      ? OWNER_MANAGER_ROLES
      : OWNER_ROLES,
  }))
}

const getDomainNameKeys = (domain: DomainFragment): readonly string[] =>
  [resolveDomainLabel(domain), domain.normalizedName, domain.name]
    .map(normalizeName)
    .filter((name): name is string => !!name)

const getOwnedDomainNameSet = (
  ownedDomains: readonly DomainFragment[],
): ReadonlySet<string> => {
  const names = new Set<string>()
  for (const domain of ownedDomains) {
    for (const key of getDomainNameKeys(domain)) names.add(key)
  }
  return names
}

export const getManagedOnlyRoleNames = (
  ownedDomains: readonly DomainFragment[],
  assignments: readonly V2RoleAssignment[],
): string[] => {
  const ownedNames = getOwnedDomainNameSet(ownedDomains)
  const roleBitmapByName = getRoleBitmapByName(assignments)
  const managedNames: string[] = []

  for (const [name, bitmap] of roleBitmapByName) {
    if (ownedNames.has(name)) continue
    if (!hasNonZeroRoleBitmap(bitmap)) continue
    managedNames.push(name)
  }

  return managedNames
}

export const applyProfileV2RoleAssignments = ({
  ownedDomains,
  managedDomains,
  assignments,
}: {
  readonly ownedDomains: readonly DomainFragment[]
  readonly managedDomains: readonly DomainFragment[]
  readonly assignments: readonly V2RoleAssignment[]
}): DashboardV2Name[] => {
  const roleBitmapByName = getRoleBitmapByName(assignments)
  const owned = ownedDomains.map((domain) => ({
    ...domain,
    nameRoles: hasRoleAssignment(domain, roleBitmapByName)
      ? OWNER_MANAGER_ROLES
      : OWNER_ROLES,
  }))

  const ownedNames = getOwnedDomainNameSet(ownedDomains)
  const managed = managedDomains
    .filter((domain) => {
      const label = normalizeName(resolveDomainLabel(domain))
      if (!label) return false
      // Check every name key (label, normalizedName, name) so a managed
      // domain that overlaps an owned domain under any key is deduped.
      return !getDomainNameKeys(domain).some((key) => ownedNames.has(key))
    })
    .map((domain) => ({
      ...domain,
      nameRoles: MANAGER_ONLY_ROLES,
    }))

  return [...owned, ...managed]
}
