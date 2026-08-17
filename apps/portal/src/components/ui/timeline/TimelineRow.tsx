import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TimelineDisclosure } from './TimelineDisclosure'

type TimelineRowProps = {
  readonly isOpen?: boolean
  readonly hoverHighlight?: boolean
  readonly onToggle?: () => void
  readonly className?: string
  readonly children: ReactNode
  readonly disclosure?: ReactNode
  readonly connectRailAbove?: boolean
  readonly connectRailBelow?: boolean
}

/** Skip toggle when the click landed on a nested link/button/chip action. */
const isInteractiveTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  target.closest('a,button,[data-stop-toggle]') !== null

const Rail = ({ className }: { readonly className?: string }) => (
  <span
    aria-hidden
    className={cn(
      'pointer-events-none absolute left-(--rail-x) w-0.5 bg-neutral-2',
      className,
    )}
  />
)

export const TimelineRow = ({
  isOpen = false,
  hoverHighlight = true,
  onToggle,
  className,
  children,
  disclosure,
  connectRailAbove = false,
  connectRailBelow = false,
}: TimelineRowProps) => {
  const hasDisclosure = disclosure != null

  const handleClick = (event: MouseEvent) => {
    if (isInteractiveTarget(event.target)) return
    onToggle?.()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle?.()
    }
  }

  return (
    <div className="relative flex flex-col">
      <div
        className={cn('relative', connectRailBelow && !hasDisclosure && 'pb-2')}
      >
        {connectRailAbove && <Rail className="top-0 h-1/2" />}
        {connectRailBelow && <Rail className="top-1/2 bottom-0" />}
        {/* biome-ignore lint/a11y/useSemanticElements: cannot use <button> — row contains nested links/chips. */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={hasDisclosure ? isOpen : undefined}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            'group/row cursor-pointer select-none rounded-md transition-none lg:pr-3',
            hoverHighlight && 'hover:bg-neutral-1',
            className,
          )}
        >
          {children}
        </div>
      </div>

      {hasDisclosure && (
        <div className={cn('relative', connectRailBelow && 'pb-2')}>
          {connectRailBelow && <Rail className="inset-y-0" />}
          <TimelineDisclosure isOpen={isOpen}>{disclosure}</TimelineDisclosure>
        </div>
      )}
    </div>
  )
}
