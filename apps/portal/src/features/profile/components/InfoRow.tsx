import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type InfoRowProps = {
  /** Optional leading icon (lucide or custom SVG component). */
  icon?: ComponentType<{ className?: string }>
  label: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Profile label/value row.
 *
 * On mobile the value wraps to its own line beneath the icon + label so wide
 * content (tx hashes, addresses, EntityBadges) can't overflow the viewport.
 * From `sm` up it sits inline on a fixed-height (`h-10`, 40px per the
 * Builder layout spec) row — the inline
 * content is single-line, so a fixed height keeps rows evenly sized, whereas
 * mobile stays auto-height to fit the stacked lines.
 */
export const InfoRow = ({
  icon: Icon,
  label,
  children,
  className,
}: InfoRowProps) => (
  <div
    className={cn(
      'flex flex-col gap-1 sm:h-10 sm:flex-row sm:items-center sm:gap-4 text-default-text',
      className,
    )}
  >
    <div className="flex items-center gap-4">
      {Icon ? <Icon className="size-4 shrink-0 text-neutral-7" /> : null}
      <span className="text-ui w-28 shrink-0 whitespace-nowrap">{label}</span>
    </div>
    <div className={cn('min-w-0 sm:pl-0', Icon && 'pl-8')}>{children}</div>
  </div>
)
