import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowRightFromLineIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import type { Address, Hash } from 'viem'
import { BlockExplorerTxLink } from '@/components/BlockExplorerTxLink'
import { AddressDisplay } from '@/components/table/EventsDataTable/AddressDisplay'
import { SortButton } from '@/components/table/SortButton'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTransactionSenders } from '@/features/profile/hooks/useTransactionSenders'
import { EventDetailSheet } from '@/features/resolver/components/EventDetailSheet'
import type { ResolverEvent } from '@/features/resolver/hooks/useResolverOverview'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/formatting/formatDateRange'

type ResolverEventRow = ResolverEvent & {
  readonly from: Address | null
}

interface ResolverEventsTableProps {
  readonly events: readonly ResolverEvent[]
  readonly enableSidebar?: boolean
}

const baseColumns: ColumnDef<ResolverEventRow>[] = [
  {
    id: 'expander',
    size: 80,
    header: () => <div />,
    cell: ({ row }) => (
      <div className="flex flex-row items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          aria-label={row.getIsExpanded() ? 'Collapse events' : 'Expand events'}
          onClick={(e) => {
            e.stopPropagation()
            row.toggleExpanded()
          }}
        >
          {row.getIsExpanded() ? <ChevronUp /> : <ChevronDown />}
          <span className="text-sm font-medium">1</span>
        </Button>
      </div>
    ),
  },
  {
    accessorKey: 'timestamp',
    size: 160,
    header: ({ column }) => (
      <SortButton
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        sortDirection={column.getIsSorted()}
      >
        Date
      </SortButton>
    ),
    cell: ({ row }) => {
      const { timestamp, blockNumber } = row.original
      if (timestamp) {
        const date = new Date(timestamp * 1000)
        return <div>{formatDate(date)}</div>
      }
      return (
        <span className="font-mono text-sm text-muted-foreground">
          Block {blockNumber.toLocaleString()}
        </span>
      )
    },
  },
  {
    accessorKey: 'transactionHash',
    size: 240,
    header: ({ column }) => (
      <SortButton
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        sortDirection={column.getIsSorted()}
      >
        Transaction
      </SortButton>
    ),
    cell: ({ row }) => {
      const txHash = row.original.transactionHash
      if (!txHash) return <span className="text-muted-foreground">-</span>
      return <BlockExplorerTxLink txHash={txHash as Hash} />
    },
  },
  {
    accessorKey: 'from',
    size: 240,
    header: ({ column }) => (
      <SortButton
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        sortDirection={column.getIsSorted()}
      >
        From
      </SortButton>
    ),
    cell: ({ row }) => {
      const from = row.original.from
      if (!from) return <span className="text-muted-foreground">-</span>
      return <AddressDisplay address={from} />
    },
  },
]

const moreColumn: ColumnDef<ResolverEventRow> = {
  id: 'more',
  size: 120,
  header: () => null,
  cell: ({ row, table }) => (
    <div className="flex justify-end pr-4">
      <Button
        variant="default"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          const meta = table.options.meta as {
            onMoreClick?: (event: ResolverEventRow) => void
          }
          meta?.onMoreClick?.(row.original)
        }}
      >
        <ArrowRightFromLineIcon className="h-4 w-4" />
        <span className="text-sm font-medium">More</span>
      </Button>
    </div>
  ),
}

export const ResolverEventsTable = ({
  events,
  enableSidebar = true,
}: ResolverEventsTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ResolverEventRow | null>(
    null,
  )

  const txHashes = events
    .map((e) => e.transactionHash)
    .filter((h): h is string => h !== null) as Hash[]

  const { data: sendersMap } = useTransactionSenders({
    transactionHashes: txHashes,
  })

  const rows: ResolverEventRow[] = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        from: event.transactionHash
          ? (sendersMap?.get(event.transactionHash as Hash) ?? null)
          : null,
      })),
    [events, sendersMap],
  )

  const columns = enableSidebar ? [...baseColumns, moreColumn] : baseColumns

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    state: { sorting, expanded },
    meta: enableSidebar
      ? {
          onMoreClick: (event: ResolverEventRow) => {
            setSelectedEvent(event)
            setSidebarOpen(true)
          },
        }
      : undefined,
  })

  const mobileContent = (
    <div className="md:hidden">
      {table.getRowModel().rows?.length ? (
        table.getRowModel().rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-2 px-4 py-4 border-b border-border last:border-b-0"
          >
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                aria-label={
                  row.getIsExpanded() ? 'Collapse events' : 'Expand events'
                }
                onClick={() => row.toggleExpanded()}
              >
                {row.getIsExpanded() ? <ChevronUp /> : <ChevronDown />}
                <span className="text-sm font-medium">1</span>
              </Button>
              {enableSidebar && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setSelectedEvent(row.original)
                    setSidebarOpen(true)
                  }}
                >
                  <ArrowRightFromLineIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">More</span>
                </Button>
              )}
            </div>
            <div className="text-sm font-medium">Date</div>
            <div className="text-base">
              {row.original.timestamp
                ? formatDate(new Date(row.original.timestamp * 1000))
                : `Block ${row.original.blockNumber.toLocaleString()}`}
            </div>
            <div className="text-sm font-medium">Transaction</div>
            <div className="text-base">
              {row.original.transactionHash ? (
                <BlockExplorerTxLink
                  txHash={row.original.transactionHash as Hash}
                />
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
            {row.original.from && (
              <>
                <div className="text-sm font-medium">From</div>
                <div className="text-base">
                  <AddressDisplay address={row.original.from} />
                </div>
              </>
            )}
            {row.getIsExpanded() && (
              <div className="pl-4 border-l-2 border-border flex flex-col gap-2">
                <div className="text-sm font-medium">Event</div>
                <div className="text-base">{row.original.type}</div>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="px-6 py-24 text-center border border-border rounded-sm">
          No events found.
        </div>
      )}
    </div>
  )

  const tableContent = (
    <div className="hidden md:block">
      <Table className="relative">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() }}>
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
              const cellClassName = cn('px-6', 'h-10 py-1')
              const totalColumns = row.getVisibleCells().length
              const trailingColSpan = totalColumns - 4

              return (
                <Fragment key={row.id}>
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cellClassName}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && (
                    <TableRow key={`${row.id}-expanded`}>
                      <TableCell colSpan={2} className={cellClassName} />
                      <TableCell className={cellClassName}>
                        <span>{row.original.type}</span>
                      </TableCell>
                      <TableCell className={cellClassName}>
                        {row.original.from ? (
                          <AddressDisplay address={row.original.from} />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {trailingColSpan > 0 && (
                        <TableCell
                          colSpan={trailingColSpan}
                          className={cellClassName}
                        />
                      )}
                    </TableRow>
                  )}
                </Fragment>
              )
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="px-6 py-24 text-center"
              >
                No events found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )

  const content = (
    <>
      {mobileContent}
      {tableContent}
    </>
  )

  if (enableSidebar) {
    return (
      <EventDetailSheet
        event={selectedEvent}
        open={sidebarOpen}
        setOpen={setSidebarOpen}
      >
        {content}
      </EventDetailSheet>
    )
  }

  return content
}
