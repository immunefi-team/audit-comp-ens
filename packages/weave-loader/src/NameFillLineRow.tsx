import type { CSSProperties } from 'react'
import { cn } from './lib/utils'

export interface NameFillLineRowProps {
  text: string
  revealRatio: number
  fill: string
  baseColor: string
  typography: CSSProperties
  animate?: boolean
  className?: string
}

/** Room below baseline so descenders stay inside the clip region. */
export const NAME_FILL_DESCENDER_PADDING = '0.14em'

/**
 * One line filled left→right: grey base + black overlay clipped horizontally
 * only. Same DOM throughout (no mount swaps) so progress updates animate smoothly.
 * Vertical clip is never applied — descenders (g, y, p) fill fully.
 */
export function NameFillLineRow({
  text,
  revealRatio,
  fill,
  baseColor,
  typography,
  animate = true,
  className,
}: NameFillLineRowProps) {
  const ratio = Math.max(0, Math.min(1, revealRatio))
  const insetRight = (1 - ratio) * 100

  const textClassName = cn('max-w-full break-all', className)
  const lineStyle: CSSProperties = {
    ...typography,
    paddingBottom: NAME_FILL_DESCENDER_PADDING,
  }

  // Progress is rAF-driven in registration — CSS clip transitions fight 60fps
  // updates and make the fill look stuck. Transitions only when explicitly wanted.
  const clipTransition = animate ? 'clip-path 0.45s ease' : 'none'

  return (
    <span className={cn('block max-w-full overflow-visible', textClassName)}>
      <span
        className="relative inline-block max-w-full overflow-visible align-bottom"
        style={lineStyle}
      >
        <span
          aria-hidden
          className="block max-w-full break-all"
          style={{ color: baseColor }}
        >
          {text}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 block max-w-full break-all overflow-visible"
          style={{
            color: fill,
            clipPath: `inset(0 ${insetRight}% 0 0)`,
            WebkitClipPath: `inset(0 ${insetRight}% 0 0)`,
            transition: clipTransition,
          }}
        >
          {text}
        </span>
      </span>
    </span>
  )
}
