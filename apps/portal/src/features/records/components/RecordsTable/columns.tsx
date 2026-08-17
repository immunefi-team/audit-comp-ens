import type { ColumnDef } from '@tanstack/react-table'
import { isAddress } from 'viem'
import { EntityBadge } from '@/components/EntityBadge'
import { SortButton } from '@/components/table/SortButton'

type AddressRecord = { type: 'address'; id: number; key: string }
type ContentHashRecord = { type: 'contentHash' }
type TextRecord = { type: 'text'; key: string }
type AbiRecord = { type: 'abi' }

export type NameRecord = { value: string } & (
  | AddressRecord
  | ContentHashRecord
  | TextRecord
  | AbiRecord
)

export const columns: ColumnDef<NameRecord>[] = [
  {
    accessorKey: 'type',
    header: ({ column }) => (
      <SortButton
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        sortDirection={column.getIsSorted()}
      >
        Type
      </SortButton>
    ),
  },
  {
    accessorKey: 'key',
    header: ({ column }) => {
      return (
        <SortButton
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
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
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          sortDirection={column.getIsSorted()}
        >
          Value
        </SortButton>
      )
    },
    cell: ({ column, row }) => {
      const value = row.getValue(column.id) as NameRecord['value']

      // Entity pill keeps records rows consistent with the other tables
      // (same hover chips and row rhythm). EVM address values link to the
      // address page; everything else gets the default pill + copy chip.
      const address =
        row.original.type === 'address' && isAddress(value) ? value : undefined

      return (
        <EntityBadge
          variant={address ? 'address' : 'default'}
          address={address}
          copyValue={value}
        >
          <span className="truncate max-w-[30vw] sm:max-w-[670px]">
            {value}
          </span>
        </EntityBadge>
      )
    },
  },
]
