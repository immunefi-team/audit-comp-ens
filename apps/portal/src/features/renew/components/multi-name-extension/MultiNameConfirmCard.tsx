import { Skeleton } from '@/components/ui/skeleton'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import type { NamePricingData } from '../../hooks/useMultiNamePricing'
import { RenewalDetailRow } from './RenewalDetailRow'

type MultiNameConfirmCardProps = {
  readonly pricingData: NamePricingData
}

export const MultiNameConfirmCard = ({
  pricingData,
}: MultiNameConfirmCardProps) => {
  const { selectedName, isLoading, display } = pricingData

  if (isLoading || !display) {
    return <MultiNameConfirmCardSkeleton name={selectedName.name} />
  }

  const { newExpiryFormatted, subtotal } = display

  return (
    <div className="border-b border-border overflow-hidden">
      <div className="w-full flex items-start gap-3 px-4 py-3">
        <div className="flex-1">
          <NameAvatar
            name={selectedName.name}
            height="40px"
            width="40px"
            rounded="rounded-sm"
          />
        </div>
        <div className="flex flex-col w-full gap-1">
          <div className="flex items-center justify-between">
            <span className="flex-1 text-left text-base font-medium truncate">
              {selectedName.name}
            </span>
            <span className="text-base shrink-0 ml-2">
              Expires {newExpiryFormatted}
            </span>
          </div>
          <dl className="space-y-1 pt-1">
            <RenewalDetailRow
              label="Subtotal:"
              labelClassName="text-base text-muted-foreground"
              value={subtotal}
              valueClassName="text-base"
            />
          </dl>
        </div>
      </div>
    </div>
  )
}

type MultiNameConfirmCardSkeletonProps = {
  readonly name: string
}

const MultiNameConfirmCardSkeleton = ({
  name,
}: MultiNameConfirmCardSkeletonProps) => (
  <div className="border-b border-border px-4 py-3 flex items-center gap-3">
    <NameAvatar name={name} height="40px" width="40px" rounded="rounded-sm" />
    <div className="flex flex-col flex-1 gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate">{name}</span>
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  </div>
)
