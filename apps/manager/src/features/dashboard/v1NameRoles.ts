import type { V1Domain } from '@/features/migration/service/v1SubgraphClient'
import type { DashboardNameRole } from './mergedNames'

const addressMatches = (
  candidate: string | null | undefined,
  ownerAddress: string | null | undefined,
) => !!candidate && !!ownerAddress && candidate.toLowerCase() === ownerAddress

export const getV1NameRoles = (
  domain: V1Domain,
  ownerAddress: string | null | undefined,
): readonly DashboardNameRole[] => {
  const normalizedOwnerAddress = ownerAddress?.toLowerCase()
  const isRegistrant = addressMatches(
    domain.registrant?.id,
    normalizedOwnerAddress,
  )
  const isWrappedOwner = addressMatches(
    domain.wrappedOwner?.id,
    normalizedOwnerAddress,
  )
  const isRegistryOwner = addressMatches(
    domain.owner.id,
    normalizedOwnerAddress,
  )

  const roles: DashboardNameRole[] = []
  if (isRegistrant || isWrappedOwner) roles.push('owner')
  if (isRegistryOwner || isWrappedOwner) roles.push('manager')
  return roles
}
