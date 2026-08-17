/**
 * Invalidate all registry-derived query caches that a role grant/revoke
 * affects, so the roles table, edit-sheet activity log, registry overview
 * (`roleCount`), and labels-page holder counts all refetch.
 *
 * Mirrors the pattern of `@/features/roles/utils/invalidateRolesQueries`
 * (used by the per-name role flow) but keyed on the registry query family.
 *
 * What does NOT need invalidating on a role mutation:
 *  - `get-registry-label-count` — labelCount is unchanged by role changes.
 *  - `nameRegistries` / `nameRegistry` — name→registry lookups, unrelated.
 *  - `registry-referenced-by` — derived from `SubregistryUpdated` logs, not
 *    from EAC role state.
 */

import type { QueryClient } from '@tanstack/react-query'

const REGISTRY_ROLE_INVALIDATION_KEYS = new Set<string>([
  // Registry overview (roleCount on RegistryInfo).
  'get-registry-info',
  // Holders table on /registry/$address/roles.
  'get-registry-roles',
  // Full per-registry event feed used by /registry/$address/history.
  'get-registry-events',
  // Per-user role-change history embedded in the edit sheet.
  'get-registry-role-history-for-account',
  // Labels table — its `roleHoldersCount` column reads `registry.roles`.
  'get-registry-labels',
])

export const invalidateRegistryQueries = (
  queryClient: QueryClient,
): Promise<void> =>
  queryClient.invalidateQueries({
    predicate: (query) =>
      REGISTRY_ROLE_INVALIDATION_KEYS.has(query.queryKey[0] as string),
    refetchType: 'all',
  })
