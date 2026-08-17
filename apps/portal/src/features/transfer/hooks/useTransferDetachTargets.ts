import { useQuery } from '@tanstack/react-query'
import { type Address, zeroAddress } from 'viem'
import { useNameResolverAddress } from '@/features/records/hooks/useNameResolverAddress'
import { getNameRegistriesQueryOptions } from '@/features/registry/hooks/useNameRegistryDiscovery'
import { getNameRolesForAccountQueryOptions } from '@/features/roles/hooks/useNameRolesForAccount'
import { getLabel } from '@/utils/token/getLabel'
import { getEthAddressQueryOptions } from '../queries/getEthAddress'

// A detach step is a registry write, not a plain owner operation: the registry
// gates `setResolver`/`setSubregistry` on the owner holding the matching role.
// A normally-registered name auto-holds these, but a migrated/locked name can
// own the token yet lack them (a migrated locked 2LD never receives
// ROLE_SET_SUBREGISTRY — its subregistry is the emancipated-subnames wrapper),
// so the write reverts with EACUnauthorizedAccountRoles. Since the detach steps
// run *before* the (irreversible) token transfer, offering an option the owner
// can't perform walks them into a partial, unrecoverable failure — the same
// trap `useCanTransferName` guards for the transfer itself. So an option is only
// shown when there's a target AND the owner holds the role to detach it.

type TransferDetachTargets = {
  /** Whether each option has a target worth showing/detaching. */
  readonly optionIsVisible: {
    readonly setEthAddress: boolean
    readonly detachResolver: boolean
    readonly detachRegistry: boolean
  }
  /** Every lookup succeeded — the targets are known. */
  readonly settled: boolean
  /** At least one lookup errored — the targets are unknown. */
  readonly failed: boolean
}

type UseTransferDetachTargetsParams = {
  readonly name: string
  /** The registry the name's token lives in (its parent's subregistry). */
  readonly registryAddress: Address
  /** The current token owner, whose detach permissions to check. */
  readonly owner: Address
}

/**
 * Discover what a name currently points at, so the transfer form knows which
 * options to offer: the ETH-address repoint only when an ETH address is set,
 * the resolver/registry detaches only when there's something to detach *and* the
 * owner can actually detach it (see the role note above).
 *
 * Keys off `isSuccess` (not `!isLoading`) so a failed lookup — which also has
 * `data === undefined` — doesn't look like "nothing to detach"; callers block on
 * {@link failed} instead of transferring with the options silently disabled.
 */
export const useTransferDetachTargets = ({
  name,
  registryAddress,
  owner,
}: UseTransferDetachTargetsParams): TransferDetachTargets => {
  // getLabel normalises and can throw on a malformed name; a name we can't parse
  // is one whose roles we can't check, so fall back to "no permission".
  let label: string | null = null
  try {
    label = getLabel(name)
  } catch {}

  const resolverQuery = useNameResolverAddress({ name })
  const registriesQuery = useQuery(getNameRegistriesQueryOptions({ name }))
  const ethAddressQuery = useQuery(getEthAddressQueryOptions(name))

  const rolesQuery = useQuery({
    ...getNameRolesForAccountQueryOptions({
      registryAddress,
      label: label ?? '',
      account: owner,
    }),
    enabled: label !== null,
  })

  const subregistryAddress = registriesQuery.data?.[0]
  const hasResolver = !!resolverQuery.data
  const hasSubregistry =
    !!subregistryAddress && subregistryAddress !== zeroAddress
  const hasEthAddress = !!ethAddressQuery.data
  const heldRoles = rolesQuery.data?.decoded ?? []

  return {
    optionIsVisible: {
      setEthAddress: ethAddressQuery.isSuccess && hasEthAddress,
      detachResolver:
        resolverQuery.isSuccess &&
        hasResolver &&
        rolesQuery.isSuccess &&
        heldRoles.includes('ROLE_SET_RESOLVER'),
      detachRegistry:
        registriesQuery.isSuccess &&
        hasSubregistry &&
        rolesQuery.isSuccess &&
        heldRoles.includes('ROLE_SET_SUBREGISTRY'),
    },
    settled:
      resolverQuery.isSuccess &&
      registriesQuery.isSuccess &&
      ethAddressQuery.isSuccess &&
      rolesQuery.isSuccess,
    failed:
      resolverQuery.isError || registriesQuery.isError || rolesQuery.isError,
  }
}
