import type { Role } from '@ensdomains/ensjs/utils/v2'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { type Address, zeroAddress } from 'viem'
import { getHasRolesQueryOptions } from '@/features/registry/hooks/useHasRoles'
import { getLabel } from '@/utils/token/getLabel'

/**
 * On-chain, `PermissionedRegistry._update` reverts a transfer with
 * `TransferDisallowed` unless the *current* owner holds `ROLE_CAN_TRANSFER_ADMIN`
 * on the name's token. Being the token owner (`latestOwner`) is NOT sufficient:
 * a subname issued with a restricted role bitmap, a name whose transfer role was
 * later revoked, or a migrated/locked name can be owned yet non-transferable.
 *
 * The transfer flow runs its (irreversible) detach steps *before* the token
 * `safeTransferFrom`, so a transfer that reverts on this role leaves the name
 * degraded — resolver/registry detached — and still un-transferred. This hook
 * mirrors the contract gate off-chain so the UI can refuse to start such a
 * transfer instead of walking the user into that trap.
 *
 * The check uses ensjs registry-mode `hasRoles`, which resolves the role against
 * `getResource(labelhash(label))`; that canonicalises to the same resource the
 * contract checks via `hasRoles(tokenId, …)`, so the two agree.
 */
const TRANSFER_ROLE: Role = 'ROLE_CAN_TRANSFER_ADMIN'

type UseCanTransferNameParams = {
  readonly name: string
  /** The registry that holds the name's token (its parent's subregistry). */
  readonly registryAddress: Address | undefined
  /** The account whose transfer permission to check (the token owner). */
  readonly account: Address | undefined
  readonly enabled?: boolean
}

type UseCanTransferNameReturn = {
  /** The owner holds `ROLE_CAN_TRANSFER_ADMIN`, so the transfer won't revert on it. */
  readonly canTransfer: boolean
  readonly isLoading: boolean
  /** The permission lookup failed — transferability is unknown, not `false`. */
  readonly isError: boolean
}

/**
 * Whether `account` is allowed to transfer `name`'s token — i.e. holds
 * `ROLE_CAN_TRANSFER_ADMIN` on it. See the note above for why token ownership
 * alone isn't enough.
 */
export function useCanTransferName({
  name,
  registryAddress,
  account,
  enabled = true,
}: UseCanTransferNameParams): UseCanTransferNameReturn {
  // getLabel normalises and can throw on a malformed name. A name we can't parse
  // is one we can't check, so treat it as "not transferable" rather than crash.
  const label = useMemo(() => {
    try {
      return getLabel(name)
    } catch {
      return null
    }
  }, [name])

  const isEnabled = enabled && !!label && !!registryAddress && !!account

  const query = useQuery({
    ...getHasRolesQueryOptions({
      registryAddress: registryAddress ?? zeroAddress,
      label: label ?? '',
      roles: [TRANSFER_ROLE],
      account: account ?? zeroAddress,
    }),
    enabled: isEnabled,
  })

  return {
    canTransfer: query.data === true,
    isLoading: isEnabled && query.isLoading,
    isError: query.isError,
  }
}
