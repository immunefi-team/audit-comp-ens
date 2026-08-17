import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { Check, Trash2, X } from 'lucide-react'
import React, { memo, useCallback, useMemo, useRef, useState } from 'react'
import { CopyButton } from '@/components/CopyButton'
import { SortButton } from '@/components/table/SortButton'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { NameRecord } from '@/features/records/components/RecordsTable/columns'
import { cn } from '@/lib/utils'
import {
  type EditableRecord,
  getRecordId,
} from '@/utils/records/editRecordUtils'
import {
  getRecordError,
  type ValidationError,
} from '@/utils/records/validateRecord'

type EditRecordsTableProps = {
  records: NameRecord[]
  globalFilter: string
  onDeleteRecord?: (record: EditableRecord) => void
  onUpdateRecord?: (record: EditableRecord, newValue: string) => void
  validationErrors?: ValidationError[]
}

/** Gets a display name for a record (used in delete confirmation) */
function getRecordDisplayName(record: EditableRecord): string {
  if (record.type === 'contentHash') {
    return 'contenthash'
  }
  if (record.type === 'abi') {
    return 'abi'
  }
  return record.key
}

/**
 * Editable input cell that manages its own state to prevent losing focus.
 * Uses uncontrolled input with ref to preserve cursor position during re-renders.
 */
const EditableValueCell = memo(function EditableValueCell({
  record,
  error,
  onUpdate,
}: {
  record: EditableRecord
  error: string | undefined
  onUpdate?: (record: EditableRecord, newValue: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-1">
      <Input
        ref={inputRef}
        defaultValue={record.value}
        className={`font-mono bg-muted ${
          error
            ? 'border-red-500 focus-visible:ring-red-500/50'
            : 'border-border'
        }`}
        onChange={(e) => {
          onUpdate?.(record, e.target.value)
        }}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
})

export const EditRecordsTable = ({
  records,
  globalFilter,
  onDeleteRecord,
  onUpdateRecord,
  validationErrors = [],
}: EditRecordsTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // Store validation errors in a ref so the columns don't need to depend on it
  // This prevents input focus loss when validation errors change
  const validationErrorsRef = useRef<ValidationError[]>(validationErrors)
  validationErrorsRef.current = validationErrors

  const handleDeleteClick = useCallback((record: EditableRecord) => {
    setPendingDeleteId(getRecordId(record))
  }, [])

  const handleCancelDelete = useCallback(() => {
    setPendingDeleteId(null)
  }, [])

  const handleConfirmDelete = useCallback(
    (record: EditableRecord) => {
      onDeleteRecord?.(record)
      setPendingDeleteId(null)
    },
    [onDeleteRecord],
  )

  // Stable function that reads from ref - doesn't cause column recreation
  const getError = useCallback(
    (recordId: string) => getRecordError(validationErrorsRef.current, recordId),
    [],
  )

  const editColumns: ColumnDef<EditableRecord>[] = useMemo(
    () => [
      {
        enableSorting: false,
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
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
      },
      {
        accessorKey: 'key',
        header: ({ column }) => {
          return (
            <SortButton
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
              sortDirection={column.getIsSorted()}
            >
              Key
            </SortButton>
          )
        },
        cell: ({ row }) => {
          const type = row.original.type

          // Single-value records use type as key
          if (type === 'contentHash' || type === 'abi') {
            return <span className="font-mono">{type}</span>
          }

          // Address records show coin type + coin name
          if (type === 'address') {
            return (
              <span className="flex flex-row items-center gap-2 font-mono">
                {row.original.id}{' '}
                <span className="font-sans text-caps text-muted-foreground">
                  {row.original.key}
                </span>
              </span>
            )
          }

          // Text records show the key
          return <span className="font-mono">{row.original.key}</span>
        },
      },
      {
        accessorKey: 'value',
        header: ({ column }) => {
          return (
            <SortButton
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === 'asc')
              }
              sortDirection={column.getIsSorted()}
            >
              Value
            </SortButton>
          )
        },
        cell: ({ row }) => {
          const recordId = getRecordId(row.original)
          const error = getError(recordId)

          return (
            <EditableValueCell
              record={row.original}
              error={error}
              onUpdate={onUpdateRecord}
            />
          )
        },
      },
      {
        id: 'actions',
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 justify-end">
            <CopyButton value={row.original.value} />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:text-destructive"
              onClick={() => handleDeleteClick(row.original)}
            >
              <Trash2 className="size-4" />
              <span className="sr-only">Delete record</span>
            </Button>
          </div>
        ),
      },
    ],
    [onUpdateRecord, handleDeleteClick, getError],
  )

  const table = useReactTable({
    data: records as EditableRecord[],
    columns: editColumns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => getRecordId(row),
    state: {
      sorting,
      globalFilter,
      rowSelection,
    },
    globalFilterFn: 'includesString',
  })

  const selectedRowCount = Object.keys(rowSelection).length

  const handleBulkDelete = useCallback(() => {
    const selected = table.getSelectedRowModel().rows
    for (const row of selected) {
      onDeleteRecord?.(row.original)
    }
    setRowSelection({})
    setPendingDeleteId(null)
    setBulkDeleteOpen(false)
  }, [table, onDeleteRecord])

  return (
    <>
      {selectedRowCount > 0 && (
        <div className="flex flex-row items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b border-border">
          <div className="flex flex-row items-center gap-2 shrink-0">
            <button
              type="button"
              className="cursor-pointer"
              onClick={() => setRowSelection({})}
              aria-label="Clear selection"
            >
              <X className="size-5" />
            </button>
            <span>{selectedRowCount} selected</span>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
            className="gap-2 whitespace-nowrap"
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
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
            table.getRowModel().rows.map((row) => {
              const rowId = getRecordId(row.original)
              const isPendingDelete = pendingDeleteId === rowId

              return (
                <React.Fragment key={row.id}>
                  <TableRow data-state={row.getIsSelected() && 'selected'}>
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
                  {isPendingDelete && (
                    <TableRow>
                      <TableCell
                        colSpan={editColumns.length}
                        className="px-4 sm:px-6 py-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            Remove {getRecordDisplayName(row.original)}?
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
                              variant="default"
                              size="sm"
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
              <TableCell
                colSpan={editColumns.length}
                className="px-6 py-24 text-center"
              >
                No records found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {selectedRowCount} records?</DialogTitle>
            <DialogDescription>
              The selected records will be marked for removal. Changes are
              applied on-chain when you click Save Changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleBulkDelete}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
