import { Link } from '@tanstack/react-router'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { Check, Plus, Search, Trash2, X } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import type { Address } from 'viem'
import { EntityBadge } from '@/components/EntityBadge'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { SortButton } from '@/components/table/SortButton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { cn } from '@/lib/utils'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

export interface SubnameRow {
  readonly name: string
  readonly owner: Address
  /** Whether the connected user has ROLE_UNREGISTER for this subname. */
  readonly canDelete?: boolean
}

const EMPTY_PENDING_SET: ReadonlySet<string> = new Set()

const OwnerCell = ({ owner }: { owner: Address }) => (
  <EntityBadge variant="address" address={owner}>
    {truncateAddress(owner)}
  </EntityBadge>
)

interface SubnamesTableProps {
  readonly subnames: readonly SubnameRow[]
  readonly name: string
  readonly canCreateSubname?: boolean
  /** Called when user confirms delete on a single subname. */
  readonly onDeleteSubname?: (subname: SubnameRow) => void
  /** Called when user clicks Clear with selection. */
  readonly onClearSelected?: (subnames: SubnameRow[]) => void
  /** True while a delete mutation is in flight; disables delete controls. */
  readonly isDeleting?: boolean
  /** Names whose delete tx is currently in flight; rendered as dimmed/loading. */
  readonly pendingNames?: ReadonlySet<string>
}

function buildColumns(
  onDeleteClick?: (name: string) => void,
  isDeleting?: boolean,
): ColumnDef<SubnameRow>[] {
  const selectColumn: ColumnDef<SubnameRow> = {
    enableSorting: false,
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
  }

  return [
    ...(onDeleteClick ? [selectColumn] : []),
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <SortButton
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          sortDirection={column.getIsSorted()}
        >
          Subname
        </SortButton>
      ),
      cell: ({ row }) => {
        const name = row.original.name
        return (
          <EntityBadge variant="name" name={name} showAvatar>
            {name}
          </EntityBadge>
        )
      },
    },
    {
      accessorKey: 'owner',
      header: ({ column }) => (
        <SortButton
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          sortDirection={column.getIsSorted()}
        >
          Owner
        </SortButton>
      ),
      cell: ({ row }) => <OwnerCell owner={row.original.owner} />,
    },
    {
      enableSorting: false,
      id: 'actions',
      header: () => null,
      cell: ({ row }) =>
        row.original.canDelete && onDeleteClick ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${row.original.name}`}
            disabled={isDeleting}
            onClick={() => onDeleteClick(row.original.name)}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null,
    },
  ]
}

export const SubnamesTable = ({
  subnames,
  name,
  canCreateSubname,
  onDeleteSubname,
  onClearSelected,
  isDeleting,
  pendingNames,
}: SubnamesTableProps) => {
  const pendingSet = pendingNames ?? EMPTY_PENDING_SET
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pendingDeleteName, setPendingDeleteName] = useState<string | null>(
    null,
  )

  const handleCancelDelete = () => setPendingDeleteName(null)

  const handleConfirmDelete = (subname: SubnameRow) => {
    onDeleteSubname?.(subname)
    setPendingDeleteName(null)
  }

  const columns = useMemo(
    () =>
      buildColumns(
        onDeleteSubname ? setPendingDeleteName : undefined,
        isDeleting,
      ),
    [onDeleteSubname, isDeleting],
  )

  const table = useReactTable({
    data: subnames as SubnameRow[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.name,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      globalFilter,
      rowSelection,
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
  })

  const rows = table.getRowModel().rows
  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const deletableSelected = selectedRows
    .filter((r) => r.original.canDelete)
    .map((r) => r.original)

  return (
    <>
      <header className="bg-background flex flex-col gap-4 sticky top-0 z-20">
        <div className="flex flex-row items-center gap-2">
          <h1 className="text-h1 flex-1">
            {subnames.length > 0
              ? `${subnames.length} subname${subnames.length !== 1 ? 's' : ''}`
              : 'Subnames'}
          </h1>
          {canCreateSubname && (
            <Button variant="default" asChild>
              <Link to="/$name/create-subname" params={{ name }}>
                <Plus className="size-4" />
                Create subname
              </Link>
            </Button>
          )}
        </div>
        {selectedCount > 0 && (
          <div className="flex flex-row items-center gap-2">
            <button
              type="button"
              className="cursor-pointer"
              onClick={() => setRowSelection({})}
            >
              <X className="size-6" />
            </button>
            <span className="text-sm text-muted-foreground flex-1">
              {selectedCount} selected
            </span>
            {onClearSelected && deletableSelected.length > 0 && (
              <Button
                variant="outline"
                className="flex items-center gap-2"
                disabled={isDeleting}
                onClick={() => onClearSelected(deletableSelected)}
              >
                <Trash2 className="size-4" />
                Clear
              </Button>
            )}
          </div>
        )}
        {subnames.length > 0 && (
          <InputGroup className="bg-background rounded-sm">
            <InputGroupInput
              className="w-full"
              placeholder="Search..."
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
        )}
      </header>

      {subnames.length === 0 && (
        <NoResultsMessage
          title="No subnames yet"
          description="Create a subname to divide this name into its own namespace."
          className="mx-0"
        />
      )}

      {/* Mobile view - Card layout */}
      <div className={cn('md:hidden', subnames.length === 0 && 'hidden')}>
        {rows.length > 0 ? (
          rows.map((row) => {
            const isPendingDelete = pendingDeleteName === row.original.name
            const isPendingTx = pendingSet.has(row.original.name)

            return (
              <React.Fragment key={row.id}>
                <div
                  className={cn(
                    'border-b border-border px-6 py-4 flex flex-col gap-3',
                    isPendingTx && 'opacity-50 pointer-events-none',
                  )}
                >
                  {isPendingTx && (
                    <span className="text-xs text-muted-foreground">
                      Deleting…
                    </span>
                  )}
                  <div className="flex flex-row gap-2 items-center">
                    {onDeleteSubname && (
                      <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(!!value)}
                        aria-label="Select row"
                      />
                    )}
                    <EntityBadge
                      variant="name"
                      name={row.original.name}
                      showAvatar
                    >
                      {row.original.name}
                    </EntityBadge>
                    {row.original.canDelete && onDeleteSubname && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 ml-auto text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${row.original.name}`}
                        disabled={isDeleting}
                        onClick={() => setPendingDeleteName(row.original.name)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-row gap-2 items-center">
                    <span className="text-sm text-muted-foreground">
                      Owner:
                    </span>
                    <EntityBadge variant="address" address={row.original.owner}>
                      {truncateAddress(row.original.owner)}
                    </EntityBadge>
                  </div>
                </div>
                {isPendingDelete && (
                  <div className="border-b border-border bg-muted px-6 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        Remove {row.original.name}?
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelDelete}
                          className="gap-1"
                        >
                          Cancel
                          <X className="size-4" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isDeleting}
                          onClick={() => handleConfirmDelete(row.original)}
                          className="gap-1"
                        >
                          Confirm
                          <Check className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            )
          })
        ) : (
          <div className="px-6 py-8 text-center text-muted-foreground">
            No subnames found.
          </div>
        )}
      </div>

      {/* Desktop view - Table layout */}
      <Table
        className={cn('relative hidden', subnames.length > 0 && 'md:table')}
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="px-6 py-2">
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
          {rows.length > 0 ? (
            rows.map((row) => {
              const isPendingDelete = pendingDeleteName === row.original.name
              const isPendingTx = pendingSet.has(row.original.name)

              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && 'selected'}
                    className={cn(
                      isPendingTx && 'opacity-50 pointer-events-none',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        className={cn('px-6', 'h-10 py-0')}
                        key={cell.id}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {isPendingDelete && (
                    <TableRow className="bg-muted">
                      <TableCell colSpan={columns.length} className="px-6 py-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            Remove {row.original.name}?
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelDelete}
                              className="gap-1"
                            >
                              Cancel
                              <X className="size-4" />
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => handleConfirmDelete(row.original)}
                              className="gap-1"
                            >
                              Confirm
                              <Check className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No subnames found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  )
}
