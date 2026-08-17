import { cn } from './lib/utils'
import { WEAVE_PROGRESS_BAR_OPTIONS } from './presets'
import type { WeaveShaderOptions } from './shader/useWeaveShader'
import { WeaveCanvas } from './WeaveCanvas'

export const WEAVE_PROGRESS_BAR_HEIGHT = 19
export const WEAVE_PROGRESS_BAR_RADIUS = 2

export interface WeaveProgressBarProps {
  progress: number
  options?: WeaveShaderOptions
  height?: number
  /** Animate the fill width (weave pattern is static). */
  animate?: boolean
  className?: string
}

export function WeaveProgressBar({
  progress,
  options = WEAVE_PROGRESS_BAR_OPTIONS,
  height = WEAVE_PROGRESS_BAR_HEIGHT,
  animate = true,
  className,
}: WeaveProgressBarProps) {
  const p = Math.max(0, Math.min(1, progress))

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-ens-gray-two',
        className,
      )}
      style={{
        height,
        borderRadius: WEAVE_PROGRESS_BAR_RADIUS,
      }}
    >
      <div
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{
          width: `${p * 100}%`,
          transition: animate ? 'width 0.5s ease-out' : 'none',
        }}
      >
        {/* Keep weave at full track width so pattern scale stays constant. */}
        <div className="h-full" style={{ width: `${p > 0 ? 100 / p : 100}%` }}>
          <WeaveCanvas className="h-full w-full" options={options} />
        </div>
      </div>
    </div>
  )
}
