import type { Role } from '@ensdomains/ensjs/utils/v2'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { registryRootPermissions } from '@/lib/roles/permissions'
import { cn } from '@/lib/utils'

type RoleCheckboxProps = {
  id: string
  label: string
  role: Role
  selectedRoles: ReadonlySet<Role>
  onToggle: (role: Role, checked: boolean) => void
  disabled?: boolean
}

const RoleCheckbox = ({
  id,
  label,
  role,
  selectedRoles,
  onToggle,
  disabled,
}: RoleCheckboxProps) => (
  <div className="flex items-center gap-2 w-24">
    <Checkbox
      id={id}
      checked={selectedRoles.has(role)}
      onCheckedChange={(c) => onToggle(role, c === true)}
      disabled={disabled}
    />
    <Label
      htmlFor={id}
      className="font-normal cursor-pointer text-muted-foreground"
    >
      {label}
    </Label>
  </div>
)

type RegistryRolePermissionListProps = {
  /** Roles currently checked. */
  selectedRoles: ReadonlySet<Role>
  /** `_ADMIN` roles the caller holds — rows without the matching admin are disabled. */
  callerAdminRoles: ReadonlySet<Role>
  onToggle: (role: Role, checked: boolean) => void
  /** Dims and disables the whole grid (e.g. while a transaction is pending). */
  disabled?: boolean
  /** Namespaces checkbox ids so two instances can't collide. */
  idPrefix?: string
  invalid?: boolean
}

/**
 * The Admin/User permission grid shared by the add- and edit-user sheets: one
 * row per root permission, each with an Admin checkbox and (where applicable) a
 * User checkbox, disabled when the caller lacks that role's admin key.
 */
export const RegistryRolePermissionList = ({
  selectedRoles,
  callerAdminRoles,
  onToggle,
  disabled = false,
  idPrefix = '',
  invalid = false,
}: RegistryRolePermissionListProps) => (
  <div
    className={cn('border-t rounded-sm divide-y transition-colors', {
      'opacity-50 pointer-events-none': disabled,
    })}
    aria-invalid={invalid}
  >
    {registryRootPermissions.map((permission) => {
      const callerLacksAdmin = !callerAdminRoles.has(permission.adminKey)
      const { key: userKey, adminKey } = permission

      return (
        <div
          key={adminKey}
          className={cn(
            'flex items-center justify-between p-4 gap-4',
            callerLacksAdmin && 'text-muted-foreground',
          )}
          title={
            callerLacksAdmin
              ? `Your account does not hold ${adminKey} on this registry and cannot manage this role.`
              : undefined
          }
        >
          <div className="flex flex-col gap-1 flex-1">
            <div className="font-medium">{permission.title}</div>
            <div className="text-sm text-muted-foreground">
              {permission.description}
            </div>
          </div>
          <div className="flex items-center gap-8">
            <RoleCheckbox
              id={`${idPrefix}${adminKey}`}
              label="Admin"
              role={adminKey}
              selectedRoles={selectedRoles}
              onToggle={onToggle}
              disabled={callerLacksAdmin}
            />
            {userKey ? (
              <RoleCheckbox
                id={`${idPrefix}${userKey}`}
                label="User"
                role={userKey}
                selectedRoles={selectedRoles}
                onToggle={onToggle}
                disabled={callerLacksAdmin}
              />
            ) : (
              <span className="flex items-center w-24 text-xs text-muted-foreground italic">
                —
              </span>
            )}
          </div>
        </div>
      )
    })}
  </div>
)
