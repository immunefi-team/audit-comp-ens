import {
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  type ChartGeometry,
  clamp,
  clientXToFraction,
  fractionToX,
  nowFraction,
  premiumCurvePoints,
  premiumPointAtFraction,
  toPolylinePoints,
} from '@/features/register/utils/premiumChart'
import {
  getPremiumPeriodDays,
  type PremiumDecayConfig,
} from '@/features/register/utils/premiumDecay'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatDottedDateTimeLocal } from '@/utils/formatting/formatDateTime'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'

const GEOMETRY: ChartGeometry = { width: 240, height: 120, padding: 6 }
const CURVE_SAMPLES = 96

/**
 * Returns refs for the label row and its labels, and synchronously positions
 * each label horizontally centred under the dot at `dotX` (in chart units),
 * clamped to the row's bounds. Runs in a layout effect so the labels never
 * flash in the wrong place.
 */
const useCenterLabelsUnderDot = (dotX: number) => {
  const labelRowRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef<HTMLSpanElement>(null)
  const priceRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const row = labelRowRef.current
    if (!row) return
    const dotPx = (dotX / GEOMETRY.width) * row.clientWidth
    for (const ref of [dateRef, priceRef]) {
      const el = ref.current
      if (!el) continue
      el.style.left = `${clamp(dotPx - el.offsetWidth / 2, 0, row.clientWidth - el.offsetWidth)}px`
    }
  }, [dotX])

  return { labelRowRef, dateRef, priceRef }
}

type TemporaryPremiumPopoverProps = {
  readonly trigger: (open: boolean) => ReactNode
  readonly premiumStart: Temporal.Instant
  readonly premiumDecayConfig: PremiumDecayConfig
}

export const TemporaryPremiumPopover = ({
  trigger,
  premiumStart,
  premiumDecayConfig,
}: TemporaryPremiumPopoverProps) => {
  const isMobile = useIsMobile()
  const dayCount = Math.round(getPremiumPeriodDays(premiumDecayConfig))

  const polyline = useMemo(
    () =>
      toPolylinePoints(
        premiumCurvePoints(
          premiumStart,
          premiumDecayConfig,
          GEOMETRY,
          CURVE_SAMPLES,
        ),
      ),
    [premiumStart, premiumDecayConfig],
  )

  const [open, setOpen] = useState(false)
  const [hoverFraction, setHoverFraction] = useState<number | null>(null)

  const activeFraction =
    hoverFraction ?? nowFraction(premiumStart, premiumDecayConfig)

  const active = premiumPointAtFraction(
    premiumStart,
    premiumDecayConfig,
    activeFraction,
    GEOMETRY,
  )

  const { labelRowRef, dateRef, priceRef } = useCenterLabelsUnderDot(active.x)

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setHoverFraction(
      clientXToFraction(event.clientX, rect.left, rect.width, GEOMETRY),
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger(open)}</PopoverTrigger>
      <PopoverContent
        align={isMobile ? 'center' : 'start'}
        side={isMobile ? 'bottom' : 'right'}
        sideOffset={isMobile ? 0 : 40}
        className="w-[280px] space-y-4"
      >
        <p className="text-sm leading-relaxed text-foreground">
          A{' '}
          <span className="font-semibold text-foreground">
            temporary premium
          </span>{' '}
          is a one-time cost applied to recently expired names to give fair
          opportunity to new registrations. The premium starts at{' '}
          {formatUsd(premiumDecayConfig.startPriceUsd)} and reduces to $0 over{' '}
          {dayCount} days. It is added once to the usual registration costs.
        </p>

        <div className="space-y-2">
          <svg
            viewBox={`0 0 ${GEOMETRY.width} ${GEOMETRY.height}`}
            className="w-full cursor-crosshair"
            role="img"
            aria-label="Temporary premium decay curve"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverFraction(null)}
          >
            {Array.from({ length: dayCount - 1 }, (_, i) => {
              const x = fractionToX((i + 1) / dayCount, GEOMETRY)
              return (
                <line
                  // biome-ignore lint/suspicious/noArrayIndexKey: static gridlines
                  key={i}
                  x1={x}
                  y1={GEOMETRY.padding}
                  x2={x}
                  y2={GEOMETRY.height - GEOMETRY.padding}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth={1}
                />
              )
            })}
            <polyline
              points={polyline}
              fill="none"
              stroke="currentColor"
              className="text-foreground"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle
              cx={active.x}
              cy={active.y}
              r={3.5}
              fill="currentColor"
              className="text-foreground"
            />
          </svg>

          <div ref={labelRowRef} className="relative h-10 text-sm">
            <span
              ref={dateRef}
              className="absolute top-0 whitespace-nowrap text-muted-foreground"
            >
              {formatDottedDateTimeLocal(active.instant)}
            </span>
            <span
              ref={priceRef}
              className="absolute top-5 whitespace-nowrap font-semibold"
            >
              {formatUsd(active.price)}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
