import type { ResolverRole } from '@ensdomains/ensjs/public/v2'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { type Address, isAddressEqual } from 'viem'
import { useConnection } from 'wagmi'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { useNameResolverAddress } from '@/features/records/hooks/useNameResolverAddress'
import { getHasRolesQueryOptions } from '@/features/registry/hooks/useHasRoles'
import { getIsPermissionedResolverQueryOptions } from '@/features/resolver/hooks/useIsPermissionedResolver'
import { computeNameResource } from '@/lib/roles/resolverRoles'

/** Roles that authorize writing common profile records on a permissioned resolver. */
export const RECORD_EDIT_ROLES = [
  'ROLE_SET_ADDR',
  'ROLE_SET_TEXT',
  'ROLE_SET_CONTENTHASH',
  'ROLE_SET_ABI',
] as const satisfies readonly ResolverRole[]

type UseCanEditRecordsParams = {
  name: string
  /** Roles that count as “can edit”. Defaults to the main record-write roles. */
  roles?: readonly ResolverRole[]
  enabled?: boolean
}

type UseCanEditRecordsReturn = {
  canEdit: boolean
  isLoading: boolean
  /** True when the connected wallet is the name token owner. */
  isOwner: boolean
  resolverAddress: Address | null | undefined
}

/**
 * Whether the connected wallet can edit records for `name`.
 *
 * - Permissioned resolvers: authorized by resolver `ROLE_SET_*` (root or
 *   name-scoped). After a transfer that keeps the resolver, the previous owner
 *   typically retains these roles while the new token owner does not.
 * - Non-permissioned / V1-style resolvers: falls back to token ownership.
 */
export function useCanEditRecords({
  name,
  roles = RECORD_EDIT_ROLES,
  enabled = true,
}: UseCanEditRecordsParams): UseCanEditRecordsReturn {
  const { address: connectedAddress } = useConnection()

  const ownerQuery = useQuery({
    ...getEnsOwnerQueryOptions({ name }),
    enabled: enabled && !!name,
  })

  const resolverQuery = useNameResolverAddress({
    name: enabled ? name : undefined,
  })
  const resolverAddress = resolverQuery.data

  const isPermissionedQuery = useQuery({
    ...getIsPermissionedResolverQueryOptions({
      resolverAddress: (resolverAddress ??
        '0x0000000000000000000000000000000000000000') as Address,
    }),
    enabled: enabled && !!resolverAddress,
  })

  const nameResource = useMemo(
    () => (name ? BigInt(computeNameResource(name)) : 0n),
    [name],
  )

  const isPermissioned = isPermissionedQuery.data === true

  const roleQueries = useQueries({
    queries: roles.map((role) => ({
      ...getHasRolesQueryOptions({
        resolverAddress: (resolverAddress ??
          '0x0000000000000000000000000000000000000000') as Address,
        resource: nameResource,
        roles: [role],
        account: (connectedAddress ??
          '0x0000000000000000000000000000000000000000') as Address,
      }),
      enabled:
        enabled && !!connectedAddress && !!resolverAddress && isPermissioned,
    })),
  })

  const isOwner =
    !!connectedAddress &&
    !!ownerQuery.data?.owner &&
    isAddressEqual(connectedAddress, ownerQuery.data.owner)

  const rolesLoading =
    isPermissioned && roleQueries.some((query) => query.isLoading)

  const isLoading =
    (enabled &&
      (ownerQuery.isLoading ||
        resolverQuery.isLoading ||
        (!!resolverAddress && isPermissionedQuery.isLoading) ||
        rolesLoading)) ||
    false

  const hasResolverRole = roleQueries.some((query) => query.data === true)

  const canEdit = (() => {
    if (!enabled || !connectedAddress || isLoading || !resolverAddress) {
      return false
    }

    if (isPermissioned) return hasResolverRole

    // Public / non-permissioned resolvers: token owner can edit.
    return isOwner
  })()

  return {
    canEdit,
    isLoading,
    isOwner,
    resolverAddress,
  }
}
