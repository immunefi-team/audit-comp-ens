import { EntityBadge } from '@/components/EntityBadge'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { GraceBadge } from '@/features/profile/components/GraceBadge'
import { getNameStatus } from '@/features/renew/utils/nameExtension'
import { decodeRoleBitmap } from '@/lib/roles/decodeRoleBitmap'
import { formatDateTime } from '@/utils/formatting/formatDateTime'
import type { V1Roles } from '@/utils/names/mergeNamesData'
import { dateToPlainDate } from '@/utils/temporal'
import type { ProtocolVersion } from '@/utils/types'

export interface NameMobileCardProps {
  name: string | null
  expiryDate?: Date | null
  roleBitmap?: string | null
  v1Roles?: V1Roles | null
  protocolVersion: ProtocolVersion
  recordCount?: number
  subdomainCount?: number
  isSelected?: boolean
  onSelectChange?: (selected: boolean) => void
  showCheckbox?: boolean
}

export const NameMobileCard = ({
  name,
  expiryDate,
  roleBitmap,
  v1Roles,
  protocolVersion,
  recordCount,
  subdomainCount,
  isSelected = false,
  onSelectChange,
  showCheckbox = true,
}: NameMobileCardProps) => {
  const v2Roles = roleBitmap ? decodeRoleBitmap(roleBitmap) : []
  const v1RoleLabels: string[] = []
  if (v1Roles?.owner) v1RoleLabels.push('Owner')
  if (v1Roles?.manager) v1RoleLabels.push('Manager')
  const hasRoles = v2Roles.length > 0 || v1RoleLabels.length > 0
  const showRecordsSubnames =
    recordCount !== undefined || subdomainCount !== undefined

  return (
    <div className="flex flex-col gap-2 px-6 py-4 bg-background border-b border-border last:border-b-0">
      {/* Name row with checkbox, avatar and copy */}
      <div className="flex flex-row gap-3 items-center">
        {showCheckbox && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelectChange?.(!!checked)}
            aria-label="Select row"
          />
        )}
        <EntityBadge variant="name" name={name ?? undefined} showAvatar>
          {name}
        </EntityBadge>
      </div>

      {/* Expiry section */}
      <div className="text-sm font-medium text-muted-foreground">Expiry</div>
      <div className="flex items-center gap-2">
        {expiryDate ? (
          <>
            <span className="text-base">
              {formatDateTime(dateToPlainDate(expiryDate))}
            </span>
            {getNameStatus(expiryDate, protocolVersion === 'ENSv2') ===
              'grace' && <GraceBadge />}
          </>
        ) : (
          <Badge variant="secondary" className="text-xs">
            Does not expire
          </Badge>
        )}
      </div>

      {/* Records and Subnames row (for overview page) */}
      {showRecordsSubnames && (
        <div className="flex gap-4 text-base">
          <div>
            <span className="font-medium">Records</span>{' '}
            <span>{recordCount ?? 0}</span>
          </div>
          <div>
            <span className="font-medium">Subnames</span>{' '}
            <span>{subdomainCount ?? 0}</span>
          </div>
        </div>
      )}

      {/* Roles section (for names page) */}
      {hasRoles && (
        <>
          <div className="text-sm font-medium text-muted-foreground">Roles</div>
          <div className="flex flex-row gap-1">
            {v2Roles.length > 0 ? (
              <Badge variant="secondary" className="text-xs">
                {v2Roles.length} {v2Roles.length === 1 ? 'Role' : 'Roles'}
              </Badge>
            ) : (
              v1RoleLabels.map((label) => (
                <Badge key={label} variant="secondary" className="text-xs">
                  {label}
                </Badge>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
