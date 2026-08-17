import type { NameWithRelation } from '@ensdomains/ensjs/subgraph'
import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { GripHorizontal } from 'lucide-react'
import type { Address } from 'viem/accounts'
import { DataTable } from '@/components/DataTable'
import { EntityBadge } from '@/components/EntityBadge'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { Badge } from '@/components/ui/badge'
import { NameMobileCard } from '@/features/names/components/NameMobileCard'
import { GraceBadge } from '@/features/profile/components/GraceBadge'
import { getNameStatus } from '@/features/renew/utils/nameExtension'
import { decodeRoleBitmap } from '@/lib/roles/decodeRoleBitmap'
import { formatDateTime } from '@/utils/formatting/formatDateTime'
import { type MergedName, mergeNamesData } from '@/utils/names/mergeNamesData'
import { dateToPlainDate } from '@/utils/temporal'
import { getV1NamesForAddressQueryOptions } from '../hooks/useV1NamesForAddress'
import { getV2NamesWithRolesForAddressQueryOptions } from '../hooks/useV2NamesWithRolesForAddress'

interface NameListProps {
  readonly address: Address
  readonly limit?: number
}

type column = MergedName

const NameCell = ({ name }: { name: string }) => (
  <EntityBadge variant="name" name={name} showAvatar>
    {name}
  </EntityBadge>
)

const columns: ColumnDef<column>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ getValue }) => {
      const name = getValue() as NameWithRelation['name']
      return name ? <NameCell name={name} /> : null
    },
  },
  {
    id: 'expiryDate',
    header: 'Expiry',
    cell: ({ row }) => {
      const expiryDate = row.original.expiryDate
      if (!expiryDate) {
        return (
          <Badge variant="secondary" className="text-xs">
            Does not expire
          </Badge>
        )
      }
      const isV2 = row.original.protocolVersion === 'ENSv2'
      const status = getNameStatus(expiryDate, isV2)
      return (
        <div className="flex items-center gap-2">
          <span>{formatDateTime(dateToPlainDate(expiryDate))}</span>
          {status === 'grace' && <GraceBadge />}
        </div>
      )
    },
  },
  {
    accessorKey: 'roleBitmap',
    header: 'Roles',
    cell: ({ row }) => {
      const roleBitmap = row.original.roleBitmap
      const v1Roles = row.original.v1Roles

      // V2 names: use roleBitmap
      if (roleBitmap) {
        const roles = decodeRoleBitmap(roleBitmap)
        if (roles.length === 0) return null

        return (
          <Badge variant="secondary" className="text-xs">
            {roles.length} {roles.length === 1 ? 'Role' : 'Roles'}
          </Badge>
        )
      }

      // V1 names: use v1Roles (owner/manager)
      if (v1Roles) {
        const roleLabels: string[] = []
        if (v1Roles.owner) roleLabels.push('Owner')
        if (v1Roles.manager) roleLabels.push('Manager')

        if (roleLabels.length === 0) return null

        return (
          <div className="flex flex-row gap-1">
            {roleLabels.map((label) => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        )
      }

      return null
    },
  },
]

export const NameList = ({ address, limit }: NameListProps) => {
  const [v1NamesQuery, v2NamesQuery] = useQueries({
    queries: [
      getV1NamesForAddressQueryOptions({ address }),
      getV2NamesWithRolesForAddressQueryOptions({ address }),
    ],
  })

  const v1Pending = v1NamesQuery.isLoading
  const v2Pending = v2NamesQuery.isLoading

  // Full spinner only while nothing is displayable; a source that already
  // has data keeps rendering while the slower one settles.
  if (v1Pending && !v2NamesQuery.data)
    return <LoadingSpinner title="Loading V1 names" />
  if (v2Pending && !v1NamesQuery.data)
    return <LoadingSpinner title="Loading V2 names" />

  const v1Failed = Boolean(v1NamesQuery.error)
  const v2Failed = Boolean(v2NamesQuery.error)

  const allData = mergeNamesData(v1NamesQuery.data, v2NamesQuery.data)
  const data = limit ? allData.slice(0, limit) : allData

  if (data.length === 0 && !v1Failed && !v2Failed && !v1Pending && !v2Pending)
    return (
      <NoResultsMessage
        title="No names yet"
        description="Names owned by this address will appear here."
        className="mx-0 my-0"
      />
    )

  return (
    <div>
      {v1Pending && <LoadingSpinner title="Loading V1 names" />}
      {v2Pending && <LoadingSpinner title="Loading V2 names" />}
      {v1Failed && (
        <ErrorMessage
          compact
          description="Error fetching ENSv1 names. Please refresh the page."
          className="mb-4"
        />
      )}
      {v2Failed && (
        <ErrorMessage
          compact
          description="Error fetching ENSv2 names. Please refresh the page."
          className="mb-4"
        />
      )}
      {/* Mobile view - Card layout */}
      <div className="md:hidden">
        {data.map((name) => (
          <NameMobileCard
            key={name.name}
            name={name.name}
            expiryDate={name.expiryDate}
            roleBitmap={name.roleBitmap}
            v1Roles={name.v1Roles}
            protocolVersion={name.protocolVersion}
            recordCount={name.recordCount}
            subdomainCount={name.subdomainCount}
            showCheckbox={false}
          />
        ))}
      </div>

      {/* Desktop view - Table layout */}
      {data.length > 0 && (
        <div className="hidden md:block">
          <DataTable data={data} columns={columns} />
        </div>
      )}

      {allData.length > 0 && (
        <Link
          to="/addr/$addr/names"
          params={{ addr: address }}
          className="flex items-center justify-center gap-1 border-t border-border p-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <GripHorizontal className="size-4" />
          Go to full list ({allData.length})
        </Link>
      )}
    </div>
  )
}
