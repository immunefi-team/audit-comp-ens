import { ChevronDown } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { entityBadgeLeadingPadScope } from '@/components/EntityBadge'
import { TimelineRow } from '@/components/ui/timeline'
import { cn } from '@/lib/utils'

export const ExpandableDetailRow = ({
  left,
  right,
  disclosure,
}: {
  readonly left: ReactNode
  readonly right?: ReactNode
  readonly disclosure: ReactNode
}) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <TimelineRow
      isOpen={isOpen}
      onToggle={() => setIsOpen((open) => !open)}
      className="ml-(--tier2-indent) lg:pl-3"
      disclosure={<div className="pl-(--detail-indent)">{disclosure}</div>}
    >
      <div className="flex items-center gap-2 py-2">
        <span
          className={cn(
            'relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-5 ring-[3px] ring-neutral-0 group-hover/row:ring-neutral-1',
            isOpen
              ? 'bg-neutral-2'
              : 'bg-neutral-1 group-hover/row:bg-neutral-2',
          )}
        >
          <ChevronDown
            className={cn(
              'size-4 stroke-[1.25] transition-transform duration-150',
              isOpen && 'rotate-180 text-neutral-7',
            )}
            aria-hidden
          />
        </span>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-y-1.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-3 lg:gap-y-0">
          <div
            className={cn(
              'flex min-w-0 flex-wrap items-center gap-2',
              entityBadgeLeadingPadScope,
            )}
          >
            {left}
          </div>
          {right != null && (
            <div className="justify-self-start whitespace-nowrap lg:justify-self-end">
              {right}
            </div>
          )}
        </div>
      </div>
    </TimelineRow>
  )
}
