import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const InfoCard = ({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) => (
  <div className={cn('rounded-sm bg-background overflow-hidden', className)}>
    <div data-slot="info-card-title" className="px-6 py-3">
      <span className="text-caps leading-none text-foreground">{title}</span>
    </div>
    <div>{children}</div>
  </div>
)

export const InfoRow = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <div
    data-slot="info-row"
    className="flex flex-col gap-2 px-6 sm:flex-row sm:items-center sm:gap-4 min-h-10 text-default-text"
  >
    <span className="text-ui w-28 shrink-0 whitespace-nowrap">{label}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
)
