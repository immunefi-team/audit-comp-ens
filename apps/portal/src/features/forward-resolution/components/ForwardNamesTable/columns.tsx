import type { ColumnDef } from '@tanstack/react-table'
import { SortButton } from '@/components/table/SortButton'
import { cn, fromCoinType } from '@/lib/utils'
import { CoinTypeLabel } from '../CoinTypeLabel'

export type ForwardName = {
  name: string
  coinTypes: string[]
}

export const columns: ColumnDef<ForwardName>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <SortButton
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        sortDirection={column.getIsSorted()}
      >
        Name
      </SortButton>
    ),
  },
  {
    accessorKey: 'coinTypes',
    header: ({ column }) => {
      return (
        <SortButton
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          sortDirection={column.getIsSorted()}
        >
          Networks
        </SortButton>
      )
    },
    cell: ({ column, row }) => {
      const coins = row
        .getValue<string[]>(column.id)
        .map((coin) => fromCoinType(BigInt(Number.parseInt(coin, 10))))

      return (
        <div
          className={cn(`w-max flex flex-row items-center gap-2`, 'truncate')}
        >
          {coins.map((coin) => (
            <CoinTypeLabel coin={coin} key={coin} />
          ))}
        </div>
      )
    },
  },
]
