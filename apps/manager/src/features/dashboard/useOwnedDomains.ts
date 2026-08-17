import { Domain_OrderBy, OrderDirection } from '@ens-apps/indexer'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useConnection } from 'wagmi'
import { useSmartAccountContextSafe } from '@/lib/smart-account/SmartAccountContext'
import { getAllDomainsInfiniteQuery } from './service/queries/getAllDashboardDomains'
import { getDashboardRoleAssignmentsQuery } from './service/queries/getDashboardRoleAssignments'
import { applyV2RoleAssignments } from './v2NameRoles'

export const useOwnedDomains = () => {
  const { address } = useConnection()
  const smartAccount = useSmartAccountContextSafe()

  const ownerAddresses = useMemo(() => {
    const candidates = [
      address,
      smartAccount?.accountAddress,
      smartAccount?.ownerAddress,
    ]
    const unique = new Set<string>()
    for (const addr of candidates) {
      if (addr) unique.add(addr.toLowerCase())
    }
    return Array.from(unique)
  }, [address, smartAccount?.accountAddress, smartAccount?.ownerAddress])

  const hasOwnerAddresses = ownerAddresses.length > 0

  const {
    data,
    isPending,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    getAllDomainsInfiniteQuery(
      hasOwnerAddresses
        ? {
            where: { owner_in: ownerAddresses },
            orderBy: Domain_OrderBy.Name,
            orderDirection: OrderDirection.Asc,
          }
        : undefined,
    ),
  )

  const roleAssignmentsQuery = useQuery(
    getDashboardRoleAssignmentsQuery(
      hasOwnerAddresses ? ownerAddresses : undefined,
    ),
  )

  useEffect(() => {
    if (isError || !hasNextPage || isFetchingNextPage) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isError])

  const v2Names = useMemo(
    () => applyV2RoleAssignments(data ?? [], roleAssignmentsQuery.data ?? []),
    [data, roleAssignmentsQuery.data],
  )

  const isRoleAssignmentsPending =
    hasOwnerAddresses && roleAssignmentsQuery.isPending

  const isAllPagesLoaded =
    !hasOwnerAddresses ||
    (!isPending &&
      !isFetchingNextPage &&
      !hasNextPage &&
      !isRoleAssignmentsPending)

  return {
    v2Names,
    hasOwnerAddresses,
    isPending: (isPending && hasOwnerAddresses) || isRoleAssignmentsPending,
    isError: isError || roleAssignmentsQuery.isError === true,
    isAllPagesLoaded,
  }
}
