import type { QueryClient } from '@tanstack/react-query'

const resolverQueryKeys = new Set([
  'get-resolver-name',
  'get-resolver',
  'user-permissioned-resolvers',
  'get-name-resolver-address',
  'ensResolver',
])

/**
 * Invalidates all resolver-related queries so that resolver data refetches
 * after a resolver change (e.g. when navigating back to resolver page).
 */
export function invalidateResolverQueries(
  queryClient: QueryClient,
): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => resolverQueryKeys.has(query.queryKey[0] as string),
    refetchType: 'all',
  })
}
