import type { ColumnDef, Row } from '@tanstack/react-table'
import { Check, PanelRight } from 'lucide-react'
import type { Address } from 'viem'
import { EntityBadge } from '@/components/EntityBadge'
import { Button } from '@/components/ui/button'
import { formatRoleLabel } from '@/lib/roles/formatRoleLabel'
import { cn } from '@/lib/utils'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

/**
 * Shared building blocks for the flat roles tables (name registry + resolver).
 * Each table supplies its own `getEntries` mapping from its row to the common
 * `RoleRowEntry[]`; the Role / Admin / Manager columns and the edit action are
 * identical across both, so they live here.
 */

export type RoleRowEntry = {
  label: string
  hasAdmin: boolean
  hasUser: boolean
}

/**
 * Collapse a flat list of role names (with `_ADMIN` variants interleaved) into
 * one entry per permission, recording whether the account holds the admin
 * and/or manager (non-admin) variant. Shared by the name-registry and registry
 * roles tables, which both receive role-name lists.
 */
export const rolesToEntries = (roles: readonly string[]): RoleRowEntry[] => {
  const map = new Map<string, RoleRowEntry>()
  for (const role of roles) {
    const label = formatRoleLabel(role)
    const existing = map.get(label) ?? {
      label,
      hasAdmin: false,
      hasUser: false,
    }
    if (role.endsWith('_ADMIN')) existing.hasAdmin = true
    else existing.hasUser = true
    map.set(label, existing)
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
}

/** Fixed-width account badge used as the leading "User" column cell. */
export const UserCell = ({ account }: { account: Address }) => (
  <div className="w-32">
    <EntityBadge variant="address" address={account}>
      {truncateAddress(account, 6, 4)}
    </EntityBadge>
  </div>
)

export const GreenCheck = () => (
  <Check className="size-5 text-success-text bg-success-fill rounded-full p-1" />
)

export const GrayDot = () => (
  <div className="size-3 rounded-full bg-neutral-2" />
)

export const PermissionMark = ({ isHeld }: { isHeld: boolean }) =>
  isHeld ? <GreenCheck /> : <GrayDot />

/** Role label + Admin/User check columns, vertically aligned per permission. */
export const buildRoleColumns = <T,>(
  getEntries: (row: T) => RoleRowEntry[],
): ColumnDef<T>[] => [
  {
    id: 'role',
    meta: { width: 224 },
    header: 'Role',
    // pt-1.5 centers the first line against the User badge line
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5 pt-1.5 text-muted-foreground">
        {getEntries(row.original).map((entry) => (
          <span
            className="font-mono pb-2 leading-5 h-5 box-content"
            key={entry.label}
          >
            {entry.label}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: 'admin',
    meta: { width: 96 },
    header: () => <div className="text-center">Admin</div>,
    cell: ({ row }) => (
      <div className="flex flex-col items-center gap-0.5 pt-1.5">
        {getEntries(row.original).map((entry) => (
          <div
            className="h-5 pb-2 box-content flex items-center"
            key={entry.label}
          >
            <PermissionMark isHeld={entry.hasAdmin} />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'user-level',
    meta: { width: 96 },
    header: () => <div className="text-center">Manager</div>,
    cell: ({ row }) => (
      <div className="flex flex-col items-center gap-0.5 pt-1.5">
        {getEntries(row.original).map((entry) => (
          <div
            className="h-5 pb-2 box-content flex items-center"
            key={entry.label}
          >
            <PermissionMark isHeld={entry.hasUser} />
          </div>
        ))}
      </div>
    ),
  },
]

/**
 * Invisible stand-in for the edit-action column so tables without edit
 * permission keep the same Role/Admin/Manager alignment as tables with it.
 */
export const buildActionSpacerColumn = <T,>(): ColumnDef<T> => ({
  id: 'actions-spacer',
  meta: { width: 48 },
  header: () => null,
  cell: () => null,
})

/** Full-height edit action that opens the row's roles slider (admins only). */
export const buildEditActionColumn = <T,>(
  onEdit: (row: Row<T>) => void,
): ColumnDef<T> => ({
  id: 'actions',
  meta: { width: 48 },
  header: () => null,
  cell: ({ row }) => (
    <Button
      variant="secondary"
      aria-label="Edit user roles"
      className="absolute inset-0 h-auto w-8 rounded-sm p-0 my-4 flex items-center justify-center"
      onClick={() => onEdit(row)}
    >
      <PanelRight className="size-4 text-muted-foreground" />
    </Button>
  ),
})

/** Wrapper classes shared by both roles tables; `hasActions` enables the
 *  last-cell overrides that let the edit button fill its cell. */
export const rolesTableClassName = (hasActions: boolean) =>
  cn(
    '[&_td]:align-top [&_.overflow-x-auto]:overflow-visible [&_tbody_tr:hover]:bg-transparent',
    // `:not(:first-child)` keeps the colSpan empty-state cell ("No results.")
    // out of the action-cell overrides — it's the only cell in its row, so it
    // is a :last-child too and would otherwise lose its padding.
    hasActions &&
      '[&_td:last-child:not(:first-child)]:p-0 [&_td:last-child:not(:first-child)]:w-12 [&_td:last-child:not(:first-child)]:relative',
  )
