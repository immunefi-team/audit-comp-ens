// ---------------------------------------------------------------------------
// Debug controls
//
// Storybook/dev-only panel for tuning the chart's steep-zone threshold and
// inspecting leader placement. Not used in production UI.
// ---------------------------------------------------------------------------

import type { ChangeEvent } from 'react'
import { cn } from '@/lib/utils'
import type { LeaderPlacement } from './premiumChartMath'

export type TemporaryPremiumChartDebugState = {
  steepThreshold: number
  showOverlay: boolean
}

export type TemporaryPremiumChartDebugControlsProps = {
  state: TemporaryPremiumChartDebugState
  onChange: (next: TemporaryPremiumChartDebugState) => void
  placement?: LeaderPlacement | null
  className?: string
}

export function TemporaryPremiumChartDebugControls({
  state,
  onChange,
  placement,
  className,
}: TemporaryPremiumChartDebugControlsProps) {
  const handleThreshold = (e: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...state, steepThreshold: Number.parseFloat(e.target.value) })

  const handleOverlay = (e: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...state, showOverlay: e.target.checked })

  const slopeText = placement
    ? placement.slope > 999
      ? '∞'
      : placement.slope.toFixed(2)
    : '—'
  const classText = placement ? (placement.isSteep ? 'steep' : 'flat') : '—'
  const dirText = placement ? `${placement.axis} → ${placement.dir}` : '—'

  return (
    <div
      className={cn(
        'space-y-3 rounded-lg border border-border bg-card p-3 text-card-foreground text-xs',
        className,
      )}
      data-testid="premium-chart-debug-controls"
    >
      <div className="flex items-center gap-3">
        <label
          className="min-w-[120px] shrink-0 text-muted-foreground"
          htmlFor="premium-chart-debug-threshold"
        >
          Steep threshold
        </label>
        <input
          className="flex-1 accent-primary"
          id="premium-chart-debug-threshold"
          max={5}
          min={0.05}
          onChange={handleThreshold}
          step={0.05}
          type="range"
          value={state.steepThreshold}
        />
        <span className="min-w-[44px] text-right font-medium font-mono text-foreground">
          {state.steepThreshold.toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 border-border border-t pt-3">
        <DebugStat label="Local slope" value={slopeText} />
        <DebugStat
          label="Classification"
          tone={placement?.isSteep ? 'warn' : 'ok'}
          value={classText}
        />
        <DebugStat label="Direction" value={dirText} />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
        <input
          checked={state.showOverlay}
          className="accent-primary"
          onChange={handleOverlay}
          type="checkbox"
        />
        Show steep-zone overlay
      </label>
    </div>
  )
}

type DebugStatProps = {
  label: string
  value: string
  tone?: 'ok' | 'warn'
}

function DebugStat({ label, value, tone }: DebugStatProps) {
  return (
    <div>
      <div className="mb-0.5 text-muted-foreground">{label}</div>
      <div
        className={cn(
          'font-medium font-mono',
          tone === 'warn' && 'text-destructive',
          tone === 'ok' && 'text-foreground',
          !tone && 'text-foreground',
        )}
      >
        {value}
      </div>
    </div>
  )
}
