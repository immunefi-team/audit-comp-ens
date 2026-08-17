import { createLink } from '@tanstack/react-router'
import type { SVGProps } from 'react'
import { forwardRef, type ReactNode } from 'react'

const CounterCardBase = forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<'a'>
>((props, ref) => (
  <a
    ref={ref}
    {...props}
    className="h-21.5 w-full flex rounded-sm overflow-hidden border border-border hover:bg-muted items-center"
  />
))
CounterCardBase.displayName = 'CounterCardBase'

export const CounterCard = createLink(CounterCardBase)

export const CounterCardRow = ({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<SVGProps<SVGSVGElement> & { className?: string }>
  children: ReactNode
}) => (
  <div className="w-full px-6 flex flex-row items-center gap-6">
    <Icon className="size-8 shrink-0 text-icon-foreground" />
    <div className="flex-1">{children}</div>
  </div>
)
