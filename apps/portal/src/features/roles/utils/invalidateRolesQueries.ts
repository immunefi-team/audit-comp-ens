/**
 * Invalidates all role-related queries.
 *
 * Used after grant/revoke transactions so the roles table and
 * canManageRoles check refetch with fresh indexer data.
 */

import type { QueryClient } from '@tanstack/react-query'

const rolesQueryKeys = new Set([
  'get-name-roles-accounts',
  'getNameRolesForAccount',
])

export function invalidateRolesQueries(
  queryClient: QueryClient,
): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => rolesQueryKeys.has(query.queryKey[0] as string),
    refetchType: 'all',
  })
}
