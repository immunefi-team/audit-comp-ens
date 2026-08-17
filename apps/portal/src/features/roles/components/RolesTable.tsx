import type { GetNameRolesAccountsReturnType } from '@ensdomains/ensjs/public/v2'
import type { ColumnDef, Row } from '@tanstack/react-table'
import { useState } from 'react'
import type { Address } from 'viem'
import { DataTable } from '@/components/DataTable'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { RolesSidebar } from '@/features/roles/components/RolesSidebar'
import {
  buildActionSpacerColumn,
  buildEditActionColumn,
  buildRoleColumns,
  rolesTableClassName,
  rolesToEntries,
  UserCell,
} from '@/features/roles/components/roleTableColumns'

type RolesTableProps = {
  readonly name: string
  readonly canManageRoles: boolean
  readonly roles: GetNameRolesAccountsReturnType
  readonly registryAddress: Address
}

type AccountGroup = {
  account: Address
  items: string[]
}

const baseColumns: ColumnDef<AccountGroup>[] = [
  {
    id: 'user',
    accessorKey: 'account',
    header: 'User',
    cell: ({ row }) => <UserCell account={row.original.account} />,
  },
  ...buildRoleColumns<AccountGroup>((row) => rolesToEntries(row.items)),
]

export const RolesTable = ({
  roles,
  name,
  canManageRoles,
  registryAddress,
}: RolesTableProps) => {
  const [editingRow, setEditingRow] = useState<Row<AccountGroup> | null>(null)
  const [open, setOpen] = useState(false)

  const data: AccountGroup[] = Array.from(roles.entries())
    .filter(([, roleNames]) => roleNames.length > 0)
    .map(([account, roleNames]) => ({ account, items: roleNames }))

  if (data.length === 0)
    return (
      <NoResultsMessage
        title="No role holders yet"
        description="Accounts with roles will appear here."
        className="mx-0"
      />
    )

  const columns: ColumnDef<AccountGroup>[] = canManageRoles
    ? [
        ...baseColumns,
        buildEditActionColumn<AccountGroup>((row) => {
          setEditingRow(row)
          setOpen(true)
        }),
      ]
    : [...baseColumns, buildActionSpacerColumn<AccountGroup>()]

  return (
    <RolesSidebar
      row={editingRow}
      open={open}
      setOpen={setOpen}
      name={name}
      canManageRoles={canManageRoles}
      registryAddress={registryAddress}
    >
      <div className={rolesTableClassName(canManageRoles)}>
        <DataTable columns={columns} data={data} />
      </div>
    </RolesSidebar>
  )
}
