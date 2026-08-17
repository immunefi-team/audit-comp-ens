import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CountBadgeProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  readonly value: number
}

const baseClassName =
  'inline-flex h-5 items-center justify-center rounded-full bg-ens-magenta/10 px-2 py-0.5 font-sans text-ens-garnet-core text-sm leading-none tracking-wide'

export const CountBadge = ({ value, className, ...props }: CountBadgeProps) => (
  <span className={cn(baseClassName, className)} {...props}>
    {value}
  </span>
)

CountBadge.displayName = 'CountBadge'
