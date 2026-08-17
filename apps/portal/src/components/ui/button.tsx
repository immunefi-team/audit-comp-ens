import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-base font-normal transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        danger:
          'bg-button-danger-default text-foreground hover:bg-button-danger-hover focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/50',
        success:
          'bg-button-success-default text-foreground hover:bg-button-success-hover',
        warning:
          'bg-button-warning-default text-foreground hover:bg-button-warning-hover',
        entity:
          'bg-type-entity-text text-type-entity-fill hover:bg-type-entity-text/90',
        'entity-outline':
          'border border-type-entity-text bg-type-entity-fill text-type-entity-text hover:bg-type-entity-fill/90',
        ghost:
          'hover:bg-accent text-primary hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
        input: 'bg-muted text-primary hover:bg-muted',
      },
      size: {
        default: 'h-9 py-2 px-4',
        sm: 'h-8 rounded-md gap-1.5 px-3',
        lg: 'h-10 rounded-md px-6',
        xs: 'h-7 rounded-xs gap-1 px-2 text-sm',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      type="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

type ButtonVariant = VariantProps<typeof buttonVariants>['variant']
type ButtonSize = VariantProps<typeof buttonVariants>['size']

export type { ButtonSize, ButtonVariant }
export { Button, buttonVariants }
