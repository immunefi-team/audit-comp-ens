import type { Address } from 'viem'
import { useEnsName } from 'wagmi'
import { EntityBadge, type EntityVariant } from '@/components/EntityBadge'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

interface AddressDisplayProps {
  address: Address
  short?: boolean
  variant?: EntityVariant
}

export const AddressDisplay = ({
  address,
  short = true,
  variant: variantProp = 'address',
}: AddressDisplayProps) => {
  const { data: ensName, isLoading } = useEnsName({ address })

  if (isLoading) {
    return (
      <div className="flex flex-row items-center gap-2">
        <div className="w-5 h-5 rounded-sm [background:var(--avatar-placeholder-gradient)]" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  const displayName = ensName || (short ? truncateAddress(address) : address)
  const variant = ensName ? 'name' : variantProp

  return (
    <EntityBadge
      variant={variant}
      name={ensName ?? undefined}
      address={address}
      showAvatar
      format="truncate"
    >
      {displayName}
    </EntityBadge>
  )
}
