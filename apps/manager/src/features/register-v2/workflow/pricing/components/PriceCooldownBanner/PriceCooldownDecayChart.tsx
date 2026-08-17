import { TemporaryPremiumChart } from '../temporary-premium/TemporaryPremiumChart'

type PriceCooldownDecayChartProps = {
  premiumStartDate: Date
  nowPoint: number
  selectedPoint: number
  selectedDisplayPrice?: number
  onSelectedPointChange: (point: number) => void
  compact?: boolean
}

export const PriceCooldownDecayChart = ({
  premiumStartDate,
  nowPoint,
  selectedPoint,
  selectedDisplayPrice,
  onSelectedPointChange,
  compact = false,
}: PriceCooldownDecayChartProps) => (
  <div className="flex w-full flex-col gap-2">
    <TemporaryPremiumChart
      height={compact ? 180 : 240}
      nowPoint={nowPoint}
      onSelect={onSelectedPointChange}
      selectedDisplayPrice={selectedDisplayPrice}
      selectedLabelBelow
      selectedPoint={selectedPoint}
      startDate={premiumStartDate}
    />
  </div>
)
