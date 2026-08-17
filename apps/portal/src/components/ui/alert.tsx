import { cva, type VariantProps } from 'class-variance-authority'
import { XIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

/* Geometry and type per the Figma Message component: 16px padding, 8px
   radius, 24px icon, 15px single-line base text. */
const alertVariants = cva(
  'relative w-full rounded-[8px] p-4 text-ui grid has-[>svg]:grid-cols-[calc(var(--spacing)*6)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-6 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default:
          'bg-type-entity-fill text-type-entity-text [&>svg]:text-current *:data-[slot=alert-description]:text-type-entity-text/90',
        neutral: 'bg-neutral-2 text-foreground',
        destructive: 'bg-message-danger-fill text-message-danger-text',
        warning: 'bg-message-warning-fill text-message-warning-text',
        success: 'bg-message-success-fill text-message-success-text',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'col-start-2 font-serif text-3xl font-normal leading-none tracking-[-0.02em]',
        className,
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'col-start-2 grid justify-items-start gap-1 text-p',
        className,
      )}
      {...props}
    />
  )
}

function AlertClose({
  className,
  children,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      data-slot="alert-close"
      type="button"
      className={cn(
        'focus-visible:border-ring focus-visible:ring-ring/50 absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-xs opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-[3px] outline-none',
        className,
      )}
      {...props}
    >
      {children ?? <XIcon className="size-4" />}
      <span className="sr-only">Dismiss</span>
    </button>
  )
}

export { Alert, AlertClose, AlertDescription, AlertTitle }
