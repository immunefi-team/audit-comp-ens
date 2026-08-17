import type { Address } from 'viem'
import { useEnsName } from 'wagmi'
import { ShieldPersonIcon } from '@/assets/icons'
import { EntityBadge } from '@/components/EntityBadge'
import { BlockCard } from '@/features/dashboard/components'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { cn } from '@/lib/utils'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import { InfoRow } from './InfoRow'

export const Owner = ({
  owner,
  label = 'Owner',
  className,
  asRow,
}: {
  owner?: Address
  label?: string
  className?: string
  asRow?: boolean
}) => {
  const {
    data: ownerName,
    error,
    isLoading,
  } = useEnsName({ address: owner, query: { enabled: Boolean(owner) } })

  if (error) {
    const failed = (
      <span className="text-sm text-muted-foreground">
        Failed to load owner
      </span>
    )
    if (asRow)
      return (
        <InfoRow label={label} className={className}>
          {failed}
        </InfoRow>
      )
    return (
      <BlockCard className={cn('flex-col items-start', className)}>
        <span className="text-sm text-muted-foreground">{label}</span>
        {failed}
      </BlockCard>
    )
  }
  if (isLoading) return <div>Loading</div>

  if (!owner) {
    if (asRow)
      return (
        <InfoRow label={label} className={className}>
          <span className="text-sm text-muted-foreground">No data</span>
        </InfoRow>
      )
    return (
      <BlockCard className={cn('flex-col items-start', className)}>
        <span className="text-sm text-muted-foreground">{label}</span>
        <span>No data</span>
      </BlockCard>
    )
  }

  const shortenedAddress = truncateAddress(owner, 6, 4)
  const variant = ownerName ? 'name' : 'address'

  if (asRow) {
    return (
      <InfoRow icon={ShieldPersonIcon} label={label} className={className}>
        <EntityBadge
          variant={variant}
          name={ownerName ?? undefined}
          address={owner}
        >
          {ownerName || shortenedAddress}
        </EntityBadge>
      </InfoRow>
    )
  }

  return (
    <BlockCard className={cn('gap-3', className)}>
      <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
        <div className="flex items-center gap-2 text-muted-foreground min-w-0">
          <NameAvatar
            width="20px"
            height="20px"
            name={ownerName || shortenedAddress}
            rounded="rounded-sm"
          />
          <span className="text-sm truncate">{label}</span>
        </div>
        <EntityBadge
          variant={variant}
          name={ownerName ?? undefined}
          address={owner}
        >
          {ownerName || shortenedAddress}
        </EntityBadge>
      </div>
    </BlockCard>
  )
}
