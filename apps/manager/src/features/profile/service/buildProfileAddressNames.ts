import type { DomainFragment } from '@ens-apps/indexer'
import type { SortDir, SortField } from '@/features/dashboard/mergedNames'
import { buildMergedNamesList } from '@/features/dashboard/mergedNames'
import { getV1NameRoles } from '@/features/dashboard/v1NameRoles'
import {
  applyProfileV2RoleAssignments,
  type V2RoleAssignment,
} from '@/features/dashboard/v2NameRoles'
import type { V1Domain } from '@/features/migration/service/v1SubgraphClient'

export type ProfileAddressNameProtocol = 'v1' | 'v2'
export type ProfileAddressNameRoleCategory = 'owned' | 'managed'

export type ProfileAddressName = {
  readonly key: string
  readonly label: string
  readonly protocol: ProfileAddressNameProtocol
  readonly expiryDate: number | null
  readonly createdAt: number | null
  readonly nameRoles: readonly ('owner' | 'manager')[]
  readonly roleCategory: ProfileAddressNameRoleCategory
}

export const isDisplayableProfileName = (name: string): boolean =>
  !name.includes('.addr.reverse') && !name.startsWith('[')

const getRoleCategory = (
  nameRoles: readonly ('owner' | 'manager')[],
): ProfileAddressNameRoleCategory =>
  nameRoles.includes('owner') ? 'owned' : 'managed'

export const buildProfileAddressNames = ({
  address,
  v2Domains,
  managedV2Domains = [],
  v1Domains,
  roleAssignments = [],
  searchQuery = '',
  sortField = 'created',
  sortDir = 'desc',
}: {
  readonly address: string
  readonly v2Domains: readonly DomainFragment[]
  readonly managedV2Domains?: readonly DomainFragment[]
  readonly v1Domains: readonly V1Domain[]
  readonly roleAssignments?: readonly V2RoleAssignment[]
  readonly searchQuery?: string
  readonly sortField?: SortField
  readonly sortDir?: SortDir
}): ProfileAddressName[] => {
  const normalizedAddress = address.toLowerCase()
  const v2Names = applyProfileV2RoleAssignments({
    ownedDomains: v2Domains,
    managedDomains: managedV2Domains,
    assignments: roleAssignments,
  })
  const v1Classified = v1Domains
    .filter((domain) => isDisplayableProfileName(domain.name))
    .map((domain) => ({
      domain,
      label: domain.labelName ?? domain.name,
      nameRoles: getV1NameRoles(domain, normalizedAddress),
    }))

  const merged = buildMergedNamesList({
    v2Names,
    v1Classified,
    searchQuery,
    sortField,
    sortDir,
  })

  return merged.map((item) => {
    const nameRoles =
      item.kind === 'v1'
        ? (item.classified.nameRoles ?? [])
        : (item.domain.nameRoles ?? ['owner'])

    return {
      key: item.key,
      label: item.sortName,
      protocol: item.kind === 'v1' ? 'v1' : 'v2',
      expiryDate: item.sortExpiry,
      createdAt: item.sortCreated,
      nameRoles,
      roleCategory: getRoleCategory(nameRoles),
    }
  })
}
