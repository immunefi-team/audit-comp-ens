import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { NamePricingData } from '../../hooks/useMultiNamePricing'
import type { MultiRenewalEntry } from '../../hooks/useRenewalTransactions'
import { MultiNameConfirmCard } from './MultiNameConfirmCard'
import {
  MultiNamePaymentTokenPicker,
  type MultiNameTokenSelection,
} from './MultiNamePaymentTokenPicker'
import { MultiNamePricingFooter } from './MultiNamePricingFooter'

type MultiNameExtendSummaryProps = {
  readonly pricingData: readonly NamePricingData[]
  readonly total: number
  readonly totalDiscount: number
  readonly allLoaded: boolean
  readonly renewals: readonly MultiRenewalEntry[]
  readonly onBack: () => void
  readonly onNext: (selection: MultiNameTokenSelection) => void
}

export const MultiNameExtendSummary = ({
  pricingData,
  total,
  totalDiscount,
  allLoaded,
  renewals,
  onBack,
  onNext,
}: MultiNameExtendSummaryProps) => {
  const [selection, setSelection] = useState<MultiNameTokenSelection | null>(
    null,
  )

  return (
    <div className="space-y-4 mt-2">
      <div className="border border-border rounded-lg overflow-hidden">
        <ul className="space-y-2">
          {pricingData.map((item) => (
            <li key={item.selectedName.name}>
              <MultiNameConfirmCard pricingData={item} />
            </li>
          ))}
        </ul>

        <MultiNamePricingFooter
          total={total}
          totalDiscount={totalDiscount}
          allLoaded={allLoaded}
        />
      </div>

      <MultiNamePaymentTokenPicker
        renewals={renewals}
        onSelectionChange={setSelection}
      />

      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          className="flex-1"
          variant="default"
          disabled={!selection}
          onClick={() => selection && onNext(selection)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
