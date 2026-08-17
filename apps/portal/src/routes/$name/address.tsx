import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { AddressResolutionTable } from '@/features/forward-resolution/components/AddressResolution/AddressResolutionTable'
import { columns } from '@/features/forward-resolution/components/AddressResolution/columns'
import {
  FORWARD_RESOLUTION_NETWORKS,
  type ForwardResolutionNetwork,
} from '@/features/forward-resolution/components/AddressResolution/networks'
import type { AddressResolutionRow } from '@/features/forward-resolution/components/AddressResolution/types'
import {
  getReverseMatchesQueryOptions,
  type ReverseMatchResult,
} from '@/features/forward-resolution/components/hooks/useReverseMatch'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { getProfileQueryOptions } from '@/features/profile/hooks/useProfile'
import { useNameResolverAddress } from '@/features/records/hooks/useNameResolverAddress'
import { DEFAULT_EVM_COIN_TYPE } from '@/lib/coinType'
import { extractErrorMessage } from '@/utils/errors/extractErrorMessage'

export const Route = createFileRoute('/$name/address')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

// `null` when there's no address to reverse-check; `undefined` while the reverse
// lookup is still in flight for a set address.
function resolveField<T>(
  address: string | null,
  pending: boolean,
  value: T | null | undefined,
) {
  if (address == null) return null
  if (pending) return undefined
  return value ?? null
}

/**
 * Resolved forward address for a network: its own coin-type record, or — for
 * L2s without a chain-specific record — the ENSIP-19 default (`0x80000000`).
 */
function forwardAddress(
  network: ForwardResolutionNetwork,
  addressByCoinType: Map<number, string>,
): string | null {
  const own = addressByCoinType.get(network.coinType) ?? null
  if (own) return own
  return network.l2ChainId != null
    ? (addressByCoinType.get(DEFAULT_EVM_COIN_TYPE) ?? null)
    : null
}

function buildRow(
  network: ForwardResolutionNetwork,
  addressByCoinType: Map<number, string>,
  resultByCoinType: Map<number, ReverseMatchResult>,
  isError: boolean,
): AddressResolutionRow {
  const address = forwardAddress(network, addressByCoinType)
  const result = resultByCoinType.get(network.coinType)
  const pending = address != null && result === undefined && !isError
  return {
    coinType: network.coinType,
    label: network.label,
    icon: network.icon,
    l2ChainId: network.l2ChainId,
    address,
    reverseMatch: resolveField(address, pending, result?.status),
    reverseName: resolveField(address, pending, result?.reverseName),
    reverseError: resolveField(address, pending, result?.error),
  }
}

function RouteComponent() {
  const { name } = Route.useParams()
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])

  const ownerQuery = useQuery(getEnsOwnerQueryOptions({ name }))
  const profileQuery = useQuery({
    ...getProfileQueryOptions({
      name,
      protocolVersion: ownerQuery.data?.protocolVersion,
    }),
  })
  const { data: resolverAddress } = useNameResolverAddress({ name })

  const addressByCoinType = new Map(
    (profileQuery.data?.records?.coins ?? []).map(
      (c) => [c.coinType, c.value] as const,
    ),
  )

  // Reverse-check each resolved address: does it point back to this name?
  const reverseMatchQuery = useQuery(
    getReverseMatchesQueryOptions({
      name,
      networks: FORWARD_RESOLUTION_NETWORKS.flatMap((network) => {
        const address = forwardAddress(network, addressByCoinType)
        return address
          ? [
              {
                coinType: network.coinType,
                address: address as Address,
                l2ChainId: network.l2ChainId,
              },
            ]
          : []
      }),
    }),
  )

  // react-table needs a STABLE `data` reference. Rebuilding this array every
  // render makes react-table's internal auto-reset re-render the route, which
  // rebuilds the array again → infinite loop. (The addr/$addr pages get this
  // stability for free because their data comes straight from useQuery.)
  const rows = useMemo<AddressResolutionRow[]>(() => {
    const addressMap = new Map(
      (profileQuery.data?.records?.coins ?? []).map(
        (c) => [c.coinType, c.value] as const,
      ),
    )
    const resultByCoinType = new Map(
      (reverseMatchQuery.data ?? []).map((r) => [r.coinType, r] as const),
    )
    return FORWARD_RESOLUTION_NETWORKS.map((network) =>
      buildRow(
        network,
        addressMap,
        resultByCoinType,
        reverseMatchQuery.isError,
      ),
    )
  }, [profileQuery.data, reverseMatchQuery.data, reverseMatchQuery.isError])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      [row.label, row.address ?? ''].join(' ').toLowerCase().includes(q),
    )
  }, [rows, search])

  const table = useReactTable({
    data: filteredRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  const searchNamesId = useId()

  if (ownerQuery.isLoading || profileQuery.isLoading) return <LoadingMessage />

  if (ownerQuery.error) {
    return (
      <ErrorMessage
        title={ownerQuery.error.cause?.name ?? 'Error'}
        description={extractErrorMessage(ownerQuery.error)}
      />
    )
  }

  if (profileQuery.error) {
    return (
      <ErrorMessage
        title="Error loading records"
        description={extractErrorMessage(profileQuery.error)}
      />
    )
  }

  if (!ownerQuery.data) {
    return (
      <NotFoundMessage
        title="Name not registered"
        description={
          <>
            <strong>{name}</strong> is not registered, so there is no address
            data to display.
          </>
        }
      />
    )
  }

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex flex-row justify-between">
          <h1 className="text-h1">Address Resolution</h1>
        </div>
        <InputGroup className="bg-background rounded-sm">
          <InputGroupInput
            id={searchNamesId}
            className="w-full"
            placeholder="Search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
      </header>
      <AddressResolutionTable
        table={table}
        name={name}
        resolverAddress={resolverAddress ?? undefined}
      />
    </>
  )
}
