import { SupervisorAccountIcon } from '@/assets/icons'
import { EntityBadge } from '@/components/EntityBadge'
import { BlockCard } from '@/features/dashboard/components'
import { InfoRow } from './InfoRow'
import { NameAvatar } from './NameAvatar'

export const ParentName = ({
  name,
  asRow,
}: {
  name: string
  asRow?: boolean
}) => {
  const parent = name.slice(name.indexOf('.') + 1)

  if (asRow) {
    if (parent === name)
      return (
        <InfoRow label="Parent">
          <span className="text-sm">Root</span>
        </InfoRow>
      )
    return (
      <InfoRow icon={SupervisorAccountIcon} label="Parent">
        <EntityBadge variant="name" name={parent}>
          {parent}
        </EntityBadge>
      </InfoRow>
    )
  }

  if (parent === name)
    return (
      <BlockCard>
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">Parent</span>
          <span>Root</span>
        </div>
      </BlockCard>
    )

  return (
    <BlockCard className="gap-3">
      <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
        <div className="flex items-center gap-2 text-muted-foreground min-w-0">
          <NameAvatar
            width="20px"
            height="20px"
            name={parent}
            rounded="rounded-sm"
          />
          <span className="text-sm truncate">Parent</span>
        </div>
        <EntityBadge variant="name" name={parent}>
          {parent}
        </EntityBadge>
      </div>
    </BlockCard>
  )
}
