import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowRightIcon, PlusIcon, Search, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useConnection, usePublicClient, useWalletClient } from 'wagmi'
import { CopyButton } from '@/components/CopyButton'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { getHasRolesQueryOptions } from '@/features/registry/hooks/useHasRoles'
import { prepareDeleteAliasTransaction } from '@/features/resolver/helpers/setAlias'
import { useDeleteAlias } from '@/features/resolver/hooks/useDeleteAlias'
import {
  getResolverOverviewQueryOptions,
  type ResolverAlias,
} from '@/features/resolver/hooks/useResolverOverview'
import { TransactionModal } from '@/features/transaction-manager/components/TransactionModal'
import { useTransactionModal } from '@/features/transaction-manager/hooks/useTransactionModal'
import { cn } from '@/lib/utils'
import { sepoliaWithEns } from '@/lib/wagmi'
import { queryClient } from '@/utils/queryClient'

export const Route = createFileRoute('/resolver/$address/aliases')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  loader: ({ params }) => {
    return queryClient.prefetchQuery(
      getResolverOverviewQueryOptions({
        address: params.address as Address,
      }),
    )
  },
})

const baseColumns: ColumnDef<ResolverAlias>[] = [
  {
    id: 'name',
    accessorKey: 'fromName',
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <NameAvatar
          name={row.original.fromName}
          width="28px"
          height="28px"
          rounded="rounded-sm"
        />
        <span className="font-mono text-sm truncate">
          {row.original.fromName}
        </span>
        <CopyButton value={row.original.fromName} />
      </div>
    ),
  },
  {
    id: 'arrow',
    size: 40,
    header: () => null,
    cell: () => (
      <ArrowRightIcon className="size-4 text-muted-foreground mx-auto" />
    ),
    enableSorting: false,
  },
  {
    id: 'aliasedNode',
    accessorKey: 'toName',
    header: 'Aliased node',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <NameAvatar
          name={row.original.toName}
          width="28px"
          height="28px"
          rounded="rounded-sm"
        />
        <span className="font-mono text-sm truncate">
          {row.original.toName}
        </span>
        <CopyButton value={row.original.toName} />
      </div>
    ),
  },
]

const deleteColumn: ColumnDef<ResolverAlias> = {
  id: 'delete',
  size: 50,
  header: () => null,
  cell: ({ row, table }) => (
    <div className="flex justify-end">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={(e) => {
          e.stopPropagation()
          const meta = table.options.meta as {
            onDelete?: (alias: ResolverAlias) => void
          }
          meta?.onDelete?.(row.original)
        }}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </div>
  ),
  enableSorting: false,
}

const DELETE_ALIAS_TX_ID = 'tx-delete-alias'

function RouteComponent() {
  const { address } = Route.useParams()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const chainId = sepoliaWithEns.id
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { address: accountAddress } = useConnection()
  const [pendingDeleteAlias, setPendingDeleteAlias] =
    useState<ResolverAlias | null>(null)
  const { openModal, closeModal, clearTransaction } = useTransactionModal()

  const {
    data: resolver,
    isLoading,
    error,
  } = useQuery(getResolverOverviewQueryOptions({ address: address as Address }))

  const { data: hasSetAliasRole } = useQuery({
    ...getHasRolesQueryOptions({
      resolverAddress: address as Address,
      roles: ['ROLE_SET_ALIAS'],
      account: accountAddress as Address,
    }),
    enabled: !!accountAddress,
  })

  const canSetAlias = Boolean(hasSetAliasRole)

  const aliases = (resolver?.aliases ?? []) as ResolverAlias[]

  const columns = useMemo(
    () => (canSetAlias ? [...baseColumns, deleteColumn] : baseColumns),
    [canSetAlias],
  )

  const deleteMutation = useDeleteAlias({
    resolverAddress: address as Address,
    walletClient,
    publicClient,
    chainId,
    id: DELETE_ALIAS_TX_ID,
  })

  const handleDelete = (alias: ResolverAlias) => {
    deleteMutation.reset()
    setPendingDeleteAlias(alias)
    openModal()
  }

  const table = useReactTable({
    data: aliases,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: { sorting, globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getRowId: (row) => row.fromName,
    meta: {
      onDelete: handleDelete,
    },
  })

  if (isLoading) return <LoadingMessage />
  if (error)
    return (
      <ErrorMessage
        compact
        description="Error fetching aliases. Please refresh the page."
      />
    )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 md:text-h1">
          {aliases.length > 0
            ? `${aliases.length} alias${aliases.length !== 1 ? 'es' : ''}`
            : 'Aliases'}
        </h1>
        {canSetAlias && (
          <Button asChild>
            <Link to="/resolver/$address/create-alias" params={{ address }}>
              <PlusIcon className="size-4" />
              Create alias
            </Link>
          </Button>
        )}
      </div>

      {aliases.length > 0 && (
        <InputGroup className="bg-background rounded-sm">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </InputGroup>
      )}

      {deleteMutation.error && (
        <Alert variant="destructive">
          <AlertDescription>{deleteMutation.error.message}</AlertDescription>
        </Alert>
      )}
      <TransactionModal
        transactions={[
          {
            id: DELETE_ALIAS_TX_ID,
            title: 'Delete alias',
            transactionName: `Delete alias ${pendingDeleteAlias?.fromName ?? ''}`,
            intent: {
              prepare: pendingDeleteAlias
                ? ({ walletClient, chainId }) =>
                    prepareDeleteAliasTransaction({
                      fromName: pendingDeleteAlias.fromName,
                      resolverAddress: address as Address,
                      walletClient,
                      chainId,
                    })
                : undefined,
            },
            onStart: () => {
              if (!pendingDeleteAlias) return
              deleteMutation.mutate(pendingDeleteAlias.fromName)
            },
            onDone: () => {
              closeModal()
              clearTransaction()
              setPendingDeleteAlias(null)
            },
          },
        ]}
      />

      {aliases.length === 0 ? (
        <NoResultsMessage
          title="No aliases yet"
          description="Create an alias to redirect resolution from one name to another."
          className="mx-0"
        />
      ) : (
        <>
          {/* Mobile view */}
          <div className="md:hidden">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    'flex flex-col gap-3 px-4 py-4 border-b border-border last:border-b-0',
                    deleteMutation.isPending &&
                      deleteMutation.variables === row.original.fromName &&
                      'opacity-50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <NameAvatar
                        name={row.original.fromName}
                        width="28px"
                        height="28px"
                        rounded="rounded-sm"
                      />
                      <span className="font-mono text-sm truncate">
                        {row.original.fromName}
                      </span>
                      <CopyButton value={row.original.fromName} />
                    </div>
                    {canSetAlias && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => {
                          const meta = table.options.meta as {
                            onDelete?: (alias: ResolverAlias) => void
                          }
                          meta?.onDelete?.(row.original)
                        }}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pl-2">
                    <ArrowRightIcon className="size-3 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-3 min-w-0">
                      <NameAvatar
                        name={row.original.toName}
                        width="24px"
                        height="24px"
                        rounded="rounded-sm"
                      />
                      <span className="font-mono text-sm truncate">
                        {row.original.toName}
                      </span>
                      <CopyButton value={row.original.toName} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-24 text-center border border-border rounded-sm">
                No aliases match your search.
              </div>
            )}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block">
            <Table className="relative">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        deleteMutation.isPending &&
                          deleteMutation.variables === row.original.fromName &&
                          'opacity-50',
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn('px-4 sm:px-6', 'h-10 py-0')}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={table.getAllColumns().length}
                      className="h-24 text-center"
                    >
                      No aliases match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
