import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { cn } from '@/lib/utils'
import type { NamePricingData } from '../../hooks/useMultiNamePricing'
import { RenewalDetailRow } from './RenewalDetailRow'

type MultiNameSummaryCardProps = {
  readonly pricingData: NamePricingData
}

export const MultiNameSummaryCard = ({
  pricingData,
}: MultiNameSummaryCardProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const { selectedName, isLoading, display } = pricingData

  if (isLoading || !display) {
    return <MultiNameSummaryCardSkeleton name={selectedName.name} />
  }

  const {
    registrationPeriod,
    newExpiryFormatted,
    priceLabel,
    priceValue,
    subtotal,
  } = display

  return (
    <div className="border-b border-border overflow-hidden">
      <button
        type="button"
        className="w-full flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <div className="flex-1">
          <NameAvatar
            name={selectedName.name}
            height="40px"
            width="40px"
            rounded="rounded-sm"
          />
        </div>
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between">
            <span className="flex-1 text-left text-base font-medium text-foreground truncate">
              {selectedName.name}
            </span>
            <ChevronDown
              className={cn(
                'size-4 text-foreground shrink-0 ml-auto transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </div>
          <div
            className={cn(
              'flex items-center justify-between',
              isOpen && 'hidden',
            )}
          >
            <span className="text-base text-muted-foreground shrink-0">
              Subtotal:
            </span>
            <span className="text-base text-foreground">{subtotal}</span>
          </div>
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-200 ease-in-out pt-1',
              isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <dl className="overflow-hidden space-y-1">
              <RenewalDetailRow
                label="Extension:"
                labelClassName="text-xs text-muted-foreground"
                value={registrationPeriod}
                valueClassName="text-foreground"
              />
              <RenewalDetailRow
                label="New expiry:"
                labelClassName="text-xs text-muted-foreground"
                value={newExpiryFormatted}
                valueClassName="font-medium text-foreground"
              />
              <RenewalDetailRow
                label={priceLabel}
                labelClassName="text-xs text-muted-foreground"
                value={priceValue}
                valueClassName="text-foreground"
              />
              <hr className="border-border" />
              <RenewalDetailRow
                label="Subtotal:"
                labelClassName="text-base text-muted-foreground"
                value={subtotal}
                valueClassName="text-foreground text-base"
              />
            </dl>
          </div>
        </div>
      </button>
    </div>
  )
}

type MultiNameSummaryCardSkeletonProps = {
  readonly name: string
}

export const MultiNameSummaryCardSkeleton = ({
  name,
}: MultiNameSummaryCardSkeletonProps) => (
  <div className="border-b border-border overflow-hidden">
    <div className="w-full flex items-start gap-3 px-4 py-3">
      <div className="flex-1">
        <NameAvatar
          name={name}
          height="40px"
          width="40px"
          rounded="rounded-sm"
        />
      </div>
      <div className="flex flex-col w-full">
        <div className="flex items-center justify-between">
          <span className="flex-1 text-left text-base font-medium text-foreground truncate">
            {name}
          </span>
          <ChevronDown className="size-4 text-foreground shrink-0 ml-auto" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-base text-muted-foreground shrink-0">
            Subtotal:
          </span>
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  </div>
)
