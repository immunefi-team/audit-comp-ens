import type { ColumnDef } from '@tanstack/react-table'
import {
  CheckCircle2,
  Clock,
  Loader2,
  SquareUser,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { SortButton } from '@/components/table/SortButton'
import { Badge } from '@/components/ui/badge'
import { DEFAULT_EVM_COIN_TYPE, MAINNET_COIN_TYPE } from '@/lib/coinType'
import { cn } from '@/lib/utils'
import type { ReverseMatchStatus } from '../hooks/useReverseMatch'
import type { AddressResolutionRow } from './types'

// Semantic fill/text tokens so the badges hold up in both light and dark mode.
const REVERSE_MATCH_BADGES: Record<
  ReverseMatchStatus,
  { icon: typeof CheckCircle2; label: string; className: string }
> = {
  verified: {
    icon: CheckCircle2,
    label: 'True',
    className: 'bg-success-fill text-success-text',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    className: 'bg-accent-fill text-accent-text',
  },
  mismatch: {
    icon: XCircle,
    label: 'False',
    className: 'bg-danger-fill text-danger-text',
  },
  unverifiable: {
    icon: TriangleAlert,
    label: 'Unverifiable',
    className: 'bg-default-fill text-default-text',
  },
}

// Default first, Mainnet second, L2s after (then alphabetical).
const sortRank = (coinType: number) => {
  if (coinType === DEFAULT_EVM_COIN_TYPE) return 0
  if (coinType === MAINNET_COIN_TYPE) return 1
  return 2
}

export const columns: ColumnDef<AddressResolutionRow>[] = [
  {
    accessorKey: 'label',
    header: ({ column }) => (
      <SortButton
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        sortDirection={column.getIsSorted()}
      >
        Network
      </SortButton>
    ),
    cell: ({ row }) => {
      const { icon, label, coinType } = row.original
      const isDefault = coinType === DEFAULT_EVM_COIN_TYPE
      return (
        <div className="flex items-center gap-3">
          {icon ? (
            <img src={icon} alt={label} className="h-5 w-5 shrink-0" />
          ) : (
            <div className="h-5 w-5 shrink-0 rounded-full bg-muted" />
          )}
          <span className={cn('text-foreground', isDefault && 'font-medium')}>
            {label}
          </span>
        </div>
      )
    },
    sortingFn: (a, b) => {
      const rankDiff =
        sortRank(a.original.coinType) - sortRank(b.original.coinType)
      if (rankDiff !== 0) return rankDiff
      return a.original.label.localeCompare(b.original.label)
    },
  },
  {
    accessorKey: 'address',
    header: ({ column }) => (
      <SortButton
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        sortDirection={column.getIsSorted()}
      >
        Record
      </SortButton>
    ),
    cell: ({ row }) => {
      const address = row.original.address
      if (!address)
        return (
          <span className="font-mono text-sm text-muted-foreground/50">
            null
          </span>
        )
      return (
        <span className="font-mono text-sm max-w-[400px] block truncate">
          {address}
        </span>
      )
    },
  },
  {
    accessorKey: 'reverseMatch',
    header: ({ column }) => (
      <SortButton
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        sortDirection={column.getIsSorted()}
      >
        Reverse match
      </SortButton>
    ),
    cell: ({ row }) => {
      const { address, reverseMatch } = row.original

      // No address to reverse-check.
      if (!address || reverseMatch === null)
        return <span className="text-muted-foreground/50">—</span>

      // Reverse lookup still in flight.
      if (reverseMatch === undefined)
        return <Loader2 className="size-4 animate-spin text-muted-foreground" />

      const {
        icon: Icon,
        label,
        className,
      } = REVERSE_MATCH_BADGES[reverseMatch]
      return (
        <div className="flex flex-row items-center gap-2">
          <Badge
            variant="outline"
            className={cn('text-xs border-transparent', className)}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Badge>
          {reverseMatch === 'verified' && (
            <Badge variant="outline" className="text-xs">
              <SquareUser className="size-4" />
              <span>Primary name</span>
            </Badge>
          )}
        </div>
      )
    },
  },
]
