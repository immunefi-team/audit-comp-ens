import type { HTMLAttributes, ReactNode } from 'react'
import { Badge as ShadcnBadge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
    | 'available'
    | 'unavailable'
    | 'premium'
  size?: 'default' | 'sm' | 'lg'
  children: ReactNode
}

const customVariantClasses = {
  available: 'bg-green-100 text-green-800 hover:bg-green-100/80',
  unavailable: 'bg-red-100 text-red-800 hover:bg-red-100/80',
  premium: 'bg-purple-100 text-purple-800 hover:bg-purple-100/80',
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  default: 'text-sm px-2.5 py-0.5',
  lg: 'text-base px-3 py-1',
}

export const Badge = ({
  variant = 'default',
  size = 'default',
  children,
  className,
  ...props
}: BadgeProps) => {
  const isCustomVariant =
    variant === 'available' ||
    variant === 'unavailable' ||
    variant === 'premium'
  const shadcnVariant = isCustomVariant
    ? 'default'
    : (variant as 'default' | 'secondary' | 'destructive' | 'outline')

  return (
    <ShadcnBadge
      className={cn(
        sizeClasses[size],
        isCustomVariant &&
          customVariantClasses[
            variant as 'available' | 'unavailable' | 'premium'
          ],
        className,
      )}
      variant={shadcnVariant}
      {...props}
    >
      {children}
    </ShadcnBadge>
  )
}

Badge.displayName = 'Badge'
