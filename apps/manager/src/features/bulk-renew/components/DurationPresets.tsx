import { Trans } from '@lingui/react/macro'
import { cn } from '@/lib/utils'
import type { PresetSummary, Selection } from '../types'
import { formatUsdAmount, PRESETS } from '../utils/pricing'

/** The 1yr / 3yr / 6yr duration cards on the summary step. */
export const DurationPresets = ({
  selection,
  presetSummaries,
  onSelectPreset,
}: {
  readonly selection: Selection
  readonly presetSummaries: readonly PresetSummary[]
  readonly onSelectPreset: (years: number) => void
}) => (
  <div className="flex flex-col gap-2">
    {PRESETS.map((preset, presetIdx) => {
      const summary = presetSummaries[presetIdx]
      const total = summary?.total ?? 0
      const isSelected =
        selection.kind === 'preset' && selection.years === preset.years
      const isLowest = presetIdx === 0

      return (
        <button
          aria-pressed={isSelected}
          className={cn(
            'flex items-center justify-between gap-3 rounded-lg border bg-ens-quartz-50 px-4 py-3 text-left transition-colors',
            isSelected
              ? 'border-ens-lapis-900'
              : 'border-ens-quartz-200 hover:border-ens-lapis-900',
          )}
          key={preset.years}
          onClick={() => onSelectPreset(preset.years)}
          type="button"
        >
          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-base text-ens-quartz-900">
              {preset.years === 1 ? (
                <Trans>1 year</Trans>
              ) : (
                <Trans>{preset.years} years</Trans>
              )}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 font-sans text-xs',
                  preset.pillClassName,
                )}
              >
                {isLowest ? (
                  <Trans>Lowest upfront cost</Trans>
                ) : (
                  <Trans>{summary?.discountPercentage ?? 0}% discount</Trans>
                )}
              </span>
              {!isLowest && (summary?.discountAmount ?? 0) > 0 && (
                <span className="font-sans text-ens-peridot-500 text-xs">
                  <Trans>
                    Save {formatUsdAmount(summary?.discountAmount ?? 0)}
                  </Trans>
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 text-base text-ens-quartz-400">
            {formatUsdAmount(total)}
          </span>
        </button>
      )
    })}
  </div>
)
