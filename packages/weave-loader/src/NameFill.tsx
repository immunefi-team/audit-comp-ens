import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from './lib/utils'
import { NameFillLineRow } from './NameFillLineRow'
import {
  type GlyphMetrics,
  groupCharsByLine,
  lineCountFromMetrics,
  lineRevealRatio,
  measureGlyphMetrics,
  segmentGraphemes,
} from './nameFillLayout'

export interface NameFillProps {
  name: string
  progress?: number
  fill?: string
  baseColor?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: number | string
  letterSpacing?: string
  lineHeight?: string | number
  animate?: boolean
  className?: string
  onLineCountChange?: (lineCount: number) => void
  onFillSettled?: () => void
}

function isGradientFill(fill: string): boolean {
  return /gradient\s*\(/i.test(fill)
}

const FILL_CLIP_TRANSITION_MS = 450

function settleDelayMs(
  animate: boolean,
  msSinceProgressChange: number,
): number {
  if (!animate) return 0
  return Math.max(
    FILL_CLIP_TRANSITION_MS,
    FILL_CLIP_TRANSITION_MS - msSinceProgressChange,
  )
}

function NameFillByClip({
  name,
  progress,
  fill,
  baseColor,
  typography,
  animate,
  className,
}: {
  name: string
  progress: number
  fill: string
  baseColor: string
  typography: CSSProperties
  animate: boolean
  className?: string
}) {
  const insetRight = (1 - progress) * 100

  return (
    <span
      className={cn('relative inline-block whitespace-nowrap', className)}
      style={typography}
    >
      <span style={{ color: baseColor }}>{name}</span>
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: fill,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
          clipPath: `inset(0 ${insetRight}% 0 0)`,
          transition: animate ? 'clip-path 0.45s ease' : 'none',
        }}
      >
        {name}
      </span>
    </span>
  )
}

export function NameFill({
  name,
  progress = 1,
  fill = '#000',
  baseColor = 'var(--color-ens-gray-two)',
  fontSize = 64,
  fontFamily = 'var(--font-mono)',
  fontWeight = 500,
  letterSpacing,
  lineHeight,
  animate = true,
  className,
  onLineCountChange,
  onFillSettled,
}: NameFillProps) {
  const rawP = Math.max(0, Math.min(1, progress))
  const fillComplete = rawP >= 1 - 1e-6
  const p = fillComplete ? 1 : rawP
  const chars = useMemo(() => segmentGraphemes(name), [name])
  const fillPosition = fillComplete ? chars.length : p * chars.length
  const gradient = isGradientFill(fill)
  const wraps = className?.includes('break-all') ?? false
  const fillSettledRef = useRef(false)
  const onFillSettledRef = useRef(onFillSettled)
  onFillSettledRef.current = onFillSettled
  const lastProgressChangeAtRef = useRef(performance.now())
  const prevProgressRef = useRef(p)

  const containerRef = useRef<HTMLSpanElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const onLineCountChangeRef = useRef(onLineCountChange)
  onLineCountChangeRef.current = onLineCountChange
  const [metrics, setMetrics] = useState<GlyphMetrics[]>([])

  const typography: CSSProperties = {
    fontFamily,
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeight,
  }

  const remeasure = () => {
    const probe = probeRef.current
    if (!probe) return

    const textNode = probe.firstChild
    if (!(textNode instanceof Text) || textNode.data !== name) return

    const next = measureGlyphMetrics(probe, textNode, chars)
    setMetrics(next)
    onLineCountChangeRef.current?.(lineCountFromMetrics(next))
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: remeasure reads the live DOM, so re-run whenever name or any typography value changes the rendered glyphs (the w-full container's ResizeObserver does not fire on font-only changes).
  useLayoutEffect(() => {
    remeasure()

    const container = containerRef.current
    if (!container) return undefined

    const observer = new ResizeObserver(remeasure)
    observer.observe(container)

    if (document.fonts?.ready) {
      document.fonts.ready.then(remeasure)
    }

    return () => observer.disconnect()
  }, [
    name,
    fontSize,
    fontFamily,
    fontWeight,
    letterSpacing,
    lineHeight,
    className,
  ])

  const layoutReady = metrics.length === chars.length
  const lines = useMemo(
    () => (layoutReady ? groupCharsByLine(chars, metrics) : []),
    [chars, layoutReady, metrics],
  )

  useEffect(() => {
    if (p !== prevProgressRef.current) {
      prevProgressRef.current = p
      lastProgressChangeAtRef.current = performance.now()
    }
  }, [p])

  useEffect(() => {
    if (gradient && !wraps) return undefined
    if (!layoutReady || p < 1) {
      if (p < 1) fillSettledRef.current = false
      return undefined
    }
    if (fillSettledRef.current) return undefined

    const settle = () => {
      if (fillSettledRef.current) return
      fillSettledRef.current = true
      onFillSettledRef.current?.()
    }

    const delay = settleDelayMs(
      animate,
      performance.now() - lastProgressChangeAtRef.current,
    )
    if (delay <= 0) {
      settle()
      return undefined
    }

    const id = window.setTimeout(settle, delay)
    return () => window.clearTimeout(id)
  }, [animate, gradient, layoutReady, p, wraps])

  if (gradient && !wraps) {
    return (
      <NameFillByClip
        animate={animate}
        baseColor={baseColor}
        className={className}
        fill={fill}
        name={name}
        progress={p}
        typography={typography}
      />
    )
  }

  return (
    <span
      aria-label={name}
      className={cn(
        'relative inline-block w-full overflow-visible align-bottom',
        className,
      )}
      ref={containerRef}
      role="img"
      style={typography}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-0 left-0 w-full whitespace-normal break-all opacity-0',
          className,
        )}
        ref={probeRef}
        style={typography}
      >
        {name}
      </span>

      {layoutReady ? (
        lines.map((line) => {
          const lineMetrics = metrics.slice(
            line.startCharIndex,
            line.startCharIndex + line.charCount,
          )
          const revealRatio = lineRevealRatio(
            line.startCharIndex,
            lineMetrics,
            fillPosition,
          )
          return (
            <NameFillLineRow
              animate={animate}
              baseColor={baseColor}
              className={className}
              fill={fill}
              key={`line-${line.lineIndex}-${line.startCharIndex}`}
              revealRatio={revealRatio}
              text={line.text}
              typography={typography}
            />
          )
        })
      ) : (
        <span style={{ color: baseColor }}>{name}</span>
      )}
    </span>
  )
}
