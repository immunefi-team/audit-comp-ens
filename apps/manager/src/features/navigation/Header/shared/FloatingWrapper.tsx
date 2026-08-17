import type React from 'react'
import { tw } from '@/utils/tailwind'

export const floatingWrapperGlassClassName = tw(
  'border border-navigation-glass-border bg-white/75 backdrop-blur-navigation-glass',
)

export const floatingWrapperClassName = tw(
  'flex h-full flex-row items-center gap-2 rounded-xl p-3',
  floatingWrapperGlassClassName,
)

export const FloatingWrapper = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => {
  return (
    <div className={tw(floatingWrapperClassName, className)}>{children}</div>
  )
}
