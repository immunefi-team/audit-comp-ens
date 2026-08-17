import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { cn } from './lib/utils'
import type { WeaveShaderOptions } from './shader/useWeaveShader'
import { WeaveName } from './WeaveName'

/** A progress milestone with a pre-resolved (already translated) label. */
export interface WeaveStep {
  label: string
  end: number
}

function stepLabelForProgress(progress: number, steps: WeaveStep[]): string {
  const p = Math.max(0, Math.min(1, progress))
  for (const step of steps) {
    if (p <= step.end) return step.label
  }
  return steps[steps.length - 1]?.label ?? ''
}

export interface WeaveLoaderProps {
  name: string
  progress: number
  stepLabel?: string
  steps?: WeaveStep[]
  hideStep?: boolean
  animate?: boolean
  weaveOptions?: WeaveShaderOptions
  fontSize?: number
  className?: string
}

export function WeaveLoader({
  name,
  progress,
  stepLabel,
  steps = [],
  hideStep = false,
  animate,
  weaveOptions,
  fontSize = 72,
  className,
}: WeaveLoaderProps) {
  const reducedMotion = usePrefersReducedMotion()
  const shouldAnimate = animate ?? !reducedMotion
  const label = stepLabel ?? stepLabelForProgress(progress, steps)

  return (
    <div
      className={cn('flex flex-col items-center gap-6 text-center', className)}
    >
      <WeaveName
        animate={shouldAnimate}
        fontSize={fontSize}
        name={name}
        progress={progress}
        weaveOptions={weaveOptions}
      />
      {hideStep ? null : (
        <p
          aria-live="polite"
          className="max-w-sm text-balance font-medium text-base text-muted-foreground transition-opacity duration-300"
          key={label}
        >
          {label}
        </p>
      )}
    </div>
  )
}
