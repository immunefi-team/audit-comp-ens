import { transactionManager } from '@ens-apps/transaction-manager'
import { useQueries } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { FastForward, Search, XIcon } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { TableDateRangeFilter } from '@/components/table/TableDateRangeFilter'
import { TableMultiSelectFilter } from '@/components/table/TableMultiSelectFilter'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { getV1NamesForAddressQueryOptions } from '@/features/dashboard/hooks/useV1NamesForAddress'
import { getV2NamesWithRolesForAddressQueryOptions } from '@/features/dashboard/hooks/useV2NamesWithRolesForAddress'
import {
  columns,
  type NameRow,
} from '@/features/names/components/NamesTable/columns'
import { NamesTable } from '@/features/names/components/NamesTable/NamesTable'
import { ExtendNameModal } from '@/features/renew/components/ExtendNameModal'
import { MultiNameExtendModal } from '@/features/renew/components/multi-name-extension/MultiNameExtendModal'
import { useV1Renewable } from '@/features/renew/hooks/useIsRenewable'
import {
  type SelectedName,
  useRenewalTransactions,
} from '@/features/renew/hooks/useRenewalTransactions'
import {
  getNameLength,
  getNameStatus,
  getSelectedNames,
  isExtendable2LD,
  MS_PER_SECOND,
} from '@/features/renew/utils/nameExtension'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import {
  isTransactionInFlight,
  useActiveTransactionState,
} from '@/features/transaction-manager/hooks/useActiveTransactionState'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import type { FilterGroup } from '@/utils/filtering/multiSelectFilter'
import type { DateRange } from '@/utils/formatting/formatDateRange'
import { queryClient } from '@/utils/queryClient'

const STATUS_FILTER_GROUPS: FilterGroup[] = [
  {
    title: 'Active',
    options: [
      { label: 'Registered', value: 'registered' },
      { label: 'Expires with parent', value: 'expires-with-parent' },
      { label: 'Does not expire', value: 'no-expiry' },
    ],
  },
  {
    title: 'Expired',
    options: [
      { label: 'Expired', value: 'expired' },
      { label: 'Grace', value: 'grace' },
      { label: 'Temporary premium', value: 'premium' },
    ],
  },
]

const LENGTH_FILTER_GROUPS: FilterGroup[] = [
  {
    title: 'Name Length',
    options: [
      { label: '3 characters', value: '3' },
      { label: '4 characters', value: '4' },
      { label: '5+ characters', value: '5+' },
    ],
  },
]

export const Route = createFileRoute('/addr/$addr/names')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  loader: ({ params }) =>
    Promise.all([
      queryClient.prefetchQuery(
        getV1NamesForAddressQueryOptions({
          address: params.addr as Address,
        }),
      ),
      queryClient.prefetchQuery(
        getV2NamesWithRolesForAddressQueryOptions({
          address: params.addr as Address,
        }),
      ),
    ]),
})

/**
 * Narrows a coarse-filtered selection to names actually renewable right now.
 *
 * `isExtendable2LD` is a coarse grace-window pre-filter and is NOT authoritative
 * for v1: ETHRenewerV1 only renews reserved/in-grace names and reverts
 * otherwise. So each selected v1 name is checked against the renewer's on-chain
 * `isRenewable` (shared with the name page via {@link useV1Renewable});
 * non-renewable ones are dropped so they never enter a single- or multi-renew
 * flow. v2 is fully covered by `isExtendable2LD` and passes through untouched.
 *
 * `isLoading` is true while any selected v1 name's check is still resolving —
 * callers must gate the Extend action on it so the flow opens against a
 * fully-resolved selection (otherwise a still-loading renewable v1 name would be
 * momentarily excluded, flipping the single↔multi modal choice mid-interaction).
 */
function useRenewableNames(candidates: readonly SelectedName[]): {
  readonly names: readonly SelectedName[]
  readonly isLoading: boolean
} {
  const v1Names = candidates
    .filter((name) => !name.isV2)
    .map((name) => name.name)

  const { isRenewable, isLoading } = useV1Renewable(v1Names)

  const names = candidates.filter((name) => name.isV2 || isRenewable(name.name))

  return { names, isLoading }
}

function RouteComponent() {
  const { addr: address } = Route.useParams() as { addr: Address }

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [extendModalOpen, setExtendModalOpen] = useState(false)

  const {
    transactions: renewalTransactions,
    startFlow,
    startMultiFlow,
    clearIncompatibleRenewalState,
  } = useRenewalTransactions({
    onComplete: () => {
      setRowSelection({})
      setExtendModalOpen(false)
      void queryClient.invalidateQueries({
        queryKey: ['get-names-for-address'],
      })
      void queryClient.invalidateQueries({
        queryKey: ['get-v2-names-with-roles-for-address'],
      })
    },
  })

  const activeTxState = useActiveTransactionState()
  const { isOpen: isTransactionModalOpen, openModal } = useTransactionModal()

  // Filter state
  const [expiryDateRange, setExpiryDateRange] = useState<DateRange>({})
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedLengths, setSelectedLengths] = useState<string[]>([])
  const [v1NamesQuery, v2NamesQuery] = useQueries({
    queries: [
      getV1NamesForAddressQueryOptions({ address }),
      getV2NamesWithRolesForAddressQueryOptions({ address }),
    ],
  })

  const data = useMemo((): NameRow[] => {
    const v1Names: NameRow[] = (v1NamesQuery.data || []).map(
      ({ name, expiryDate, relation }) => ({
        name,
        expiryDate: expiryDate?.date ?? null,
        roleBitmap: null,
        v1Roles: {
          // For wrapped names: wrappedOwner controls both ownership and management
          // For unwrapped names: registrant is Owner, registry owner is Manager
          owner: relation.registrant || relation.wrappedOwner,
          manager: relation.owner || relation.wrappedOwner,
        },
        protocolVersion: 'ENSv1',
      }),
    )

    const v2Names: NameRow[] = (v2NamesQuery.data || []).map(
      ({ name, expiryDate, roleBitmap }) => ({
        name,
        expiryDate: expiryDate ? new Date(expiryDate * MS_PER_SECOND) : null,
        roleBitmap,
        v1Roles: null,
        protocolVersion: 'ENSv2',
      }),
    )

    return [...v1Names, ...v2Names]
  }, [v1NamesQuery.data, v2NamesQuery.data])

  // Apply filters to data
  const filteredData = useMemo(() => {
    let filtered = data

    // Filter by expiry date range
    if (expiryDateRange.from || expiryDateRange.to) {
      filtered = filtered.filter((row) => {
        if (!row.expiryDate) return false
        if (expiryDateRange.from && row.expiryDate < expiryDateRange.from)
          return false
        if (expiryDateRange.to && row.expiryDate > expiryDateRange.to)
          return false
        return true
      })
    }

    // Filter by status
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((row) => {
        const status = getNameStatus(
          row.expiryDate,
          row.protocolVersion === 'ENSv2',
        )
        return selectedStatuses.includes(status)
      })
    }

    // Filter by name length
    if (selectedLengths.length > 0) {
      filtered = filtered.filter((row) => {
        const length = getNameLength(row.name)
        return selectedLengths.includes(length)
      })
    }

    return filtered
  }, [data, expiryDateRange, selectedStatuses, selectedLengths])

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      rowSelection,
      columnFilters,
    },
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  })

  const rowCount = useMemo(
    () => Object.keys(rowSelection).length,
    [rowSelection],
  )

  // Coarse grace-window pre-filter, then narrow to names that are actually
  // renewable now (drops non-renewable v1 names — see useRenewableNames).
  const coarseExtendable = getSelectedNames(rowSelection, filteredData).filter(
    isExtendable2LD,
  )
  const { names: extendableNames, isLoading: renewabilityLoading } =
    useRenewableNames(coarseExtendable)

  const searchNamesId = useId()

  if (v1NamesQuery.isLoading) {
    return <LoadingMessage />
  }

  if (v2NamesQuery.isLoading) {
    return <LoadingMessage />
  }

  if (v1NamesQuery.error) {
    return (
      <ErrorMessage
        compact
        description="Error fetching names. Please refresh the page."
      />
    )
  }

  if (v2NamesQuery.error) {
    return (
      <ErrorMessage
        compact
        description="Error fetching names. Please refresh the page."
      />
    )
  }

  const nameCount = filteredData.length
  const totalCount = data.length
  const hasActiveFilters =
    expiryDateRange.from ||
    expiryDateRange.to ||
    selectedStatuses.length > 0 ||
    selectedLengths.length > 0

  if (totalCount === 0)
    return (
      <>
        <header className="bg-background flex flex-col gap-4 sticky top-0 z-20">
          <h1 className="text-h1">Names</h1>
        </header>
        <NoResultsMessage
          title="No names yet"
          description="Names owned by this address will appear here."
          className="mx-0"
        />
      </>
    )

  return (
    <>
      <header className="bg-background flex flex-col gap-4 sticky top-0 z-20">
        <div className="flex flex-row justify-between">
          <h1 className="text-h1">
            {hasActiveFilters ? `${nameCount} of ${totalCount}` : nameCount}{' '}
            names
          </h1>
        </div>
        {rowCount > 0 ? (
          <div className="flex flex-col lg:flex-row w-full lg:justify-between lg:items-center gap-4">
            <div className="flex flex-row items-center gap-1 shrink-0">
              <button
                type="button"
                className="cursor-pointer"
                onClick={() => setRowSelection({})}
              >
                <XIcon className="size-6" />
              </button>
              {rowCount} selected
            </div>
            <Button
              variant="default"
              size="sm"
              disabled={extendableNames.length === 0 || renewabilityLoading}
              onClick={() => {
                if (isTransactionInFlight(activeTxState)) {
                  openModal()
                  return
                }
                // Stale terminal-state transactions (success/error) block the
                // modal; remove only that entry so a fresh extend flow can
                // start without touching any other in-flight transactions.
                if (activeTxState) {
                  transactionManager.cancelTransaction(activeTxState.txId)
                }
                clearIncompatibleRenewalState(
                  extendableNames.length === 1 ? 'single' : 'multi',
                )
                setExtendModalOpen(true)
              }}
            >
              <FastForward className="size-4" />
              Extend
            </Button>
          </div>
        ) : (
          <>
            <InputGroup className="bg-background rounded-sm">
              <InputGroupInput
                id={searchNamesId}
                className="w-full"
                placeholder="Search names..."
                onChange={(event) => table.setGlobalFilter(event.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
            <div className="flex flex-row gap-2 flex-wrap">
              <TableDateRangeFilter
                label="Expiry"
                dateRange={expiryDateRange}
                onChange={setExpiryDateRange}
              />
              <TableMultiSelectFilter
                label="Status"
                groups={STATUS_FILTER_GROUPS}
                selectedValues={selectedStatuses}
                onChange={setSelectedStatuses}
              />
              <TableMultiSelectFilter
                label="Length"
                groups={LENGTH_FILTER_GROUPS}
                selectedValues={selectedLengths}
                onChange={setSelectedLengths}
              />
            </div>
          </>
        )}
      </header>
      <div className="overflow-x-auto">
        <NamesTable table={table} />
      </div>
      {extendableNames.length === 1 && (
        <ExtendNameModal
          open={extendModalOpen && !isTransactionModalOpen}
          onClose={() => setExtendModalOpen(false)}
          selectedName={extendableNames[0]}
          onExtend={(config) => {
            startFlow(extendableNames[0], config)
            openModal()
          }}
        />
      )}
      {extendableNames.length > 1 && (
        <MultiNameExtendModal
          open={extendModalOpen && !isTransactionModalOpen}
          onClose={() => setExtendModalOpen(false)}
          selectedNames={extendableNames}
          onExtend={(config) => {
            startMultiFlow({
              renewals: config.renewals,
              tokenAddress: config.selection.tokenAddress,
              payments: config.selection.payments,
            })
            openModal()
          }}
        />
      )}
      <TransactionModal transactions={renewalTransactions} />
    </>
  )
}
