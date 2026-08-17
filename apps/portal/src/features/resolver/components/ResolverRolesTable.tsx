import type { ColumnDef, Row } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import type { Address } from 'viem'
import { DataTable } from '@/components/DataTable'
import { EntityBadge } from '@/components/EntityBadge'
import { ResolverRolesSidebar } from '@/features/resolver/components/ResolverRolesSidebar'
import type {
  ResolverNode,
  ResolverRole,
} from '@/features/resolver/hooks/useResolverOverview'
import {
  buildActionSpacerColumn,
  buildEditActionColumn,
  buildRoleColumns,
  type RoleRowEntry,
  rolesTableClassName,
} from '@/features/roles/components/roleTableColumns'
import {
  type AccountRoleGroup,
  buildResourceToNameMap,
  groupRolesByAccount,
  resolverPermissions,
} from '@/lib/roles/resolverRoles'
import { roleToPermissions } from '@/lib/roles/rolesToPermissions'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

type ResolverRolesTableProps = {
  readonly roles: readonly ResolverRole[]
  readonly nodes: readonly ResolverNode[]
  readonly resolverAddress: Address
  readonly canManageRoles: boolean
  /** Render read-only: no edit action, no slider (e.g. embedded on /$name/roles). */
  readonly disableEdit?: boolean
}

/** One entry per held resolver permission, with its Admin / User (manager) state. */
const toRoleEntries = (decodedRoles: readonly string[]): RoleRowEntry[] => {
  const map = roleToPermissions(decodedRoles)
  return resolverPermissions
    .filter((p) => map.has(p.key))
    .map((p) => ({
      label: p.title,
      hasAdmin: Boolean(map.get(p.key)?.admin),
      hasUser: Boolean(map.get(p.key)?.manager),
    }))
}

const baseColumns: ColumnDef<AccountRoleGroup>[] = [
  {
    id: 'user',
    accessorKey: 'account',
    meta: { width: 176 },
    header: () => <span className="text-muted-foreground">User</span>,
    cell: ({ row }) => (
      <div className="w-32">
        <EntityBadge
          variant="address"
          address={row.original.account as Address}
        >
          {truncateAddress(row.original.account as Address, 6, 4)}
        </EntityBadge>
      </div>
    ),
  },
  {
    id: 'name',
    header: () => <span className="text-muted-foreground">Name</span>,
    cell: ({ row }) => {
      const names = row.original.resolvedNames
      if (names.length === 0) return null
      return (
        <div className="flex flex-wrap gap-1">
          {names.map((name) => (
            <span
              key={name}
              className="font-mono text-sm text-muted-foreground"
            >
              {name}
            </span>
          ))}
        </div>
      )
    },
  },
  ...buildRoleColumns<AccountRoleGroup>((row) =>
    toRoleEntries(row.decodedRoles),
  ),
]

export const ResolverRolesTable = ({
  roles,
  nodes,
  resolverAddress,
  canManageRoles,
  disableEdit = false,
}: ResolverRolesTableProps) => {
  const [editingRow, setEditingRow] = useState<Row<AccountRoleGroup> | null>(
    null,
  )
  const [open, setOpen] = useState(false)

  const data = useMemo(
    () => groupRolesByAccount(roles, buildResourceToNameMap(nodes)),
    [roles, nodes],
  )

  const showActions = canManageRoles && !disableEdit

  const columns: ColumnDef<AccountRoleGroup>[] = showActions
    ? [
        ...baseColumns,
        buildEditActionColumn<AccountRoleGroup>((row) => {
          setEditingRow(row)
          setOpen(true)
        }),
      ]
    : [...baseColumns, buildActionSpacerColumn<AccountRoleGroup>()]

  const table = (
    <div className={rolesTableClassName(showActions)}>
      <DataTable columns={columns} data={data} />
    </div>
  )

  // Read-only embed: no slider, just the table.
  if (disableEdit) return table

  return (
    <ResolverRolesSidebar
      row={editingRow}
      open={open}
      setOpen={setOpen}
      resolverAddress={resolverAddress}
      canManageRoles={canManageRoles}
    >
      {table}
    </ResolverRolesSidebar>
  )
}
