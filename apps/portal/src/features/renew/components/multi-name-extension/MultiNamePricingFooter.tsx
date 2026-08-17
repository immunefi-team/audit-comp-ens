import { formatUsd } from '@/utils/formatting/formatUsdCeil'

type MultiNamePricingFooterProps = {
  readonly total: number
  readonly totalDiscount: number
  readonly allLoaded: boolean
}

export const MultiNamePricingFooter = ({
  total,
  totalDiscount,
  allLoaded,
}: MultiNamePricingFooterProps) => {
  const showDiscount = allLoaded && totalDiscount > 0

  return (
    <div className="space-y-1 p-4">
      {showDiscount && (
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total discount:</span>
          <span className="text-sm font-medium text-success-text">
            -{formatUsd(totalDiscount)}
          </span>
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <span className="text-xl text-accent-text font-medium">Total:</span>
        <span className="text-xl text-accent-text font-medium">
          {allLoaded ? formatUsd(total) : '—'}
        </span>
      </div>
    </div>
  )
}
