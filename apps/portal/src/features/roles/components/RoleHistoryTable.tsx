import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowRightFromLineIcon } from 'lucide-react'
import { useState } from 'react'
import type { Address } from 'viem'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  EventsSidebar,
  type EventsTableData,
} from '@/components/table/EventsDataTable'
import { AddressDisplay } from '@/components/table/EventsDataTable/AddressDisplay'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getRoleHistoryQueryOptions,
  type RoleHistoryEntry,
} from '@/features/roles/hooks/useRoleHistory'
import { sepoliaWithEns } from '@/lib/wagmi'
import { formatTimestamp } from '@/utils/formatting/formatTimestamp'
import type { ENSEvent } from '@/utils/history/transformHistoryToEvents'

/**
 * Map a {@link RoleHistoryEntry} into the generic `EventsTableData` shape
 * consumed by `EventsSidebar`, so role-history rows reuse the same subgraph
 * transaction sidebar as the rest of the app.
 */
const roleHistoryEntryToTransaction = (
  entry: RoleHistoryEntry,
): EventsTableData<ENSEvent> => ({
  transactionID: entry.transactionHash,
  blockNumber: entry.blockNumber,
  timestamp: BigInt(entry.timestamp),
  from: entry.account,
  network: { name: 'Sepolia', chainId: sepoliaWithEns.id },
  events: [
    {
      id: `${entry.transactionHash}-eac-roles-changed`,
      type: 'EACRolesChanged',
      category: 'domain',
      details: {
        resource: entry.resource,
        account: entry.account,
        oldRoles: [...entry.oldRoles],
        newRoles: [...entry.newRoles],
      },
    },
  ],
})

const RoleDiff = ({ entry }: { readonly entry: RoleHistoryEntry }) => {
  const added = entry.newRoles.filter((r) => !entry.oldRoles.includes(r))
  const removed = entry.oldRoles.filter((r) => !entry.newRoles.includes(r))

  return (
    <div className="flex flex-wrap gap-1">
      {added.map((role) => (
        <Badge key={role} variant="success">
          + {role}
        </Badge>
      ))}
      {removed.map((role) => (
        <Badge key={role} variant="danger">
          - {role}
        </Badge>
      ))}
      {added.length === 0 && removed.length === 0 && (
        <span className="text-muted-foreground text-sm">No change</span>
      )}
    </div>
  )
}

const RoleCountChange = ({ entry }: { readonly entry: RoleHistoryEntry }) => (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <span>{entry.oldRoles.length} roles</span>
    <ArrowRight className="size-3" />
    <span>{entry.newRoles.length} roles</span>
  </div>
)

const MoreButton = ({ onClick }: { readonly onClick: () => void }) => (
  <Button
    variant="default"
    size="sm"
    onClick={(e) => {
      e.stopPropagation()
      onClick()
    }}
  >
    <ArrowRightFromLineIcon className="h-4 w-4" />
    <span className="text-sm font-medium">More</span>
  </Button>
)

const RoleHistoryMobileCard = ({
  entry,
  onMoreClick,
}: {
  readonly entry: RoleHistoryEntry
  readonly onMoreClick: () => void
}) => (
  <div className="flex flex-col gap-2 px-6 py-4 bg-background border-b border-border">
    <div className="flex justify-end">
      <MoreButton onClick={onMoreClick} />
    </div>

    <div className="text-sm font-medium">Date</div>
    <div className="text-base text-muted-foreground">
      {formatTimestamp(BigInt(entry.timestamp))}
    </div>

    <div className="text-sm font-medium">Account</div>
    <div className="text-base">
      <AddressDisplay address={entry.account} />
    </div>

    <div className="text-sm font-medium">Changes</div>
    <div className="text-base">
      <RoleDiff entry={entry} />
    </div>

    <div className="text-sm font-medium">Roles</div>
    <div className="text-base">
      <RoleCountChange entry={entry} />
    </div>
  </div>
)

export const RoleHistoryTable = ({
  name,
  label,
  account,
}: {
  readonly name: string
  readonly label?: string
  readonly account?: Address
}) => {
  const [selectedEntry, setSelectedEntry] = useState<RoleHistoryEntry | null>(
    null,
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const {
    data: allData,
    isLoading,
    error,
  } = useQuery(getRoleHistoryQueryOptions({ label }))

  // Filter by account if provided
  const data =
    account && allData
      ? allData.filter(
          (entry) => entry.account.toLowerCase() === account.toLowerCase(),
        )
      : allData

  const handleMoreClick = (entry: RoleHistoryEntry) => {
    setSelectedEntry(entry)
    setSidebarOpen(true)
  }

  if (isLoading) return <LoadingSpinner title="Loading role history" />

  if (error) {
    return (
      <ErrorMessage
        compact
        description="Error fetching role history. Please refresh the page."
      />
    )
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm p-4">
        No role history found.
      </p>
    )
  }

  return (
    <EventsSidebar
      transaction={
        selectedEntry ? roleHistoryEntryToTransaction(selectedEntry) : null
      }
      name={name}
      open={sidebarOpen}
      setOpen={setSidebarOpen}
    >
      {/* Mobile view - card layout */}
      <div className="md:hidden border rounded-sm overflow-hidden">
        {data.map((entry) => (
          <RoleHistoryMobileCard
            key={`${entry.transactionHash}-${entry.account}`}
            entry={entry}
            onMoreClick={() => handleMoreClick(entry)}
          />
        ))}
      </div>

      {/* Desktop view - table layout */}
      <div className="hidden md:block border rounded-sm overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Changes</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry) => (
              <TableRow key={`${entry.transactionHash}-${entry.account}`}>
                <TableCell className="px-4 sm:px-6 h-10 py-1 text-sm text-muted-foreground">
                  {formatTimestamp(BigInt(entry.timestamp))}
                </TableCell>
                <TableCell className="px-4 sm:px-6 h-10 py-1">
                  <AddressDisplay address={entry.account} />
                </TableCell>
                <TableCell className="px-4 sm:px-6 h-10 py-1">
                  <RoleDiff entry={entry} />
                </TableCell>
                <TableCell className="px-4 sm:px-6 h-10 py-1">
                  <RoleCountChange entry={entry} />
                </TableCell>
                <TableCell className="px-4 sm:px-6 h-10 py-1">
                  <div className="flex justify-end">
                    <MoreButton onClick={() => handleMoreClick(entry)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </EventsSidebar>
  )
}
