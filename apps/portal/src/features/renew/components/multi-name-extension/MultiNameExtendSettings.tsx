import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { NamePricingData } from '../../hooks/useMultiNamePricing'
import type { ExtensionSpanType } from '../ExtensionDurationOrExpiryPicker'
import { ExtensionDurationOrExpiryPicker } from '../ExtensionDurationOrExpiryPicker'
import { MultiNamePricingFooter } from './MultiNamePricingFooter'
import { MultiNameSummaryCard } from './MultiNameSummaryCard'

type MultiNameExtendSettingsProps = {
  readonly pricingData: readonly NamePricingData[]
  readonly total: number
  readonly totalDiscount: number
  readonly allLoaded: boolean
  readonly latestExpiry: Date | null
  readonly duration: number
  readonly setDuration: (duration: number) => void
  readonly spanType: ExtensionSpanType
  readonly setSpanType: (type: ExtensionSpanType) => void
  readonly onBack: () => void
  readonly onNext: () => void
}

export const MultiNameExtendSettings = ({
  pricingData,
  total,
  totalDiscount,
  allLoaded,
  latestExpiry,
  duration,
  setDuration,
  spanType,
  setSpanType,
  onBack,
  onNext,
}: MultiNameExtendSettingsProps) => {
  return (
    <div className="space-y-6 mt-2">
      <ExtensionDurationOrExpiryPicker
        duration={duration}
        setDuration={setDuration}
        expiryDate={latestExpiry}
        spanType={spanType}
        setSpanType={setSpanType}
      />

      <div className="border border-border rounded-lg overflow-hidden">
        <ul>
          {pricingData.map((item) => (
            <li key={item.selectedName.name}>
              <MultiNameSummaryCard pricingData={item} />
            </li>
          ))}
        </ul>

        <MultiNamePricingFooter
          total={total}
          totalDiscount={totalDiscount}
          allLoaded={allLoaded}
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Button className="flex-1" variant="default" onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  )
}
