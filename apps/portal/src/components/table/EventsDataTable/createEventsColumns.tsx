import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRightFromLineIcon, ChevronDown, ChevronUp } from 'lucide-react'
import type { Hash } from 'viem'
import { BlockExplorerTxLink } from '@/components/BlockExplorerTxLink'
import { AddressDisplay } from '@/components/table/EventsDataTable/AddressDisplay'
import { SortButton } from '@/components/table/SortButton'
import { Button } from '@/components/ui/button'
import { formatUnixDateTimeLocal } from '@/utils/formatting/formatDateTime'
import type { BaseEvent, EventsTableData } from './types'

type ColumnConfig = {
  enableSidebar?: boolean
  enableNetwork?: boolean
  defaultNetworkName?: string
  defaultNetworkIcon?: string
}

export const createEventsColumns = <TEvent extends BaseEvent = BaseEvent>({
  enableSidebar = true,
  enableNetwork = true,
  defaultNetworkName = 'Sepolia',
  defaultNetworkIcon = '/icons/eth.svg',
}: ColumnConfig = {}): ColumnDef<EventsTableData<TEvent>>[] => {
  const baseColumns: ColumnDef<EventsTableData<TEvent>>[] = [
    {
      id: 'expander',
      size: 80,
      header: () => <div />,
      cell: ({ row }) => {
        const eventCount = row.original.events.length
        return (
          <div className="flex flex-row items-center gap-1">
            {eventCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                aria-label={
                  row.getIsExpanded() ? 'Collapse events' : 'Expand events'
                }
                onClick={(e) => {
                  e.stopPropagation()
                  row.toggleExpanded()
                }}
              >
                {row.getIsExpanded() ? <ChevronUp /> : <ChevronDown />}
                <span className="text-sm font-medium">{eventCount}</span>
              </Button>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'timestamp',
      size: 190,
      header: ({ column }) => (
        <SortButton
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          sortDirection={column.getIsSorted()}
        >
          Date
        </SortButton>
      ),
      cell: ({ row }) => {
        const timestamp = row.original.timestamp
        if (!timestamp) return <div>-</div>

        return (
          <div className="whitespace-nowrap">
            {formatUnixDateTimeLocal(timestamp)}
          </div>
        )
      },
    },
    {
      accessorKey: 'transactionID',
      size: 240,
      header: ({ column }) => (
        <SortButton
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          sortDirection={column.getIsSorted()}
        >
          Transaction
        </SortButton>
      ),
      cell: ({ row }) => (
        <BlockExplorerTxLink
          txHash={row.original.transactionID as Hash}
          chainId={row.original.network?.chainId}
        />
      ),
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

  if (enableNetwork) {
    baseColumns.push({
      accessorKey: 'network',
      size: 140,
      header: ({ column }) => (
        <SortButton
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          sortDirection={column.getIsSorted()}
        >
          Network
        </SortButton>
      ),
      cell: ({ row }) => {
        const network = row.original.network
        const networkName = network?.name || defaultNetworkName
        const networkIcon = network?.icon || defaultNetworkIcon

        return (
          <div className="flex flex-row items-center gap-2">
            <img src={networkIcon} alt={networkName} className="w-4 h-4" />
            <span>{networkName}</span>
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const nameA = rowA.original.network?.name || defaultNetworkName
        const nameB = rowB.original.network?.name || defaultNetworkName
        return nameA.localeCompare(nameB)
      },
    })
  }

  if (enableSidebar) {
    baseColumns.push({
      id: 'more',
      size: 120,
      header: () => null,
      cell: ({ row, table }) => {
        return (
          <div className="flex justify-end pr-4">
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                const meta = table.options.meta as {
                  onMoreClick?: (r: typeof row) => void
                }
                meta?.onMoreClick?.(row)
              }}
            >
              <ArrowRightFromLineIcon className="h-4 w-4" />
              <span className="text-sm font-medium">More</span>
            </Button>
          </div>
        )
      },
    })
  }

  return baseColumns
}
