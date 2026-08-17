import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import type * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-[450] w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        ghost:
          'bg-accent text-foreground [a&]:hover:bg-accent/90 [a&]:hover:text-accent-foreground/90',
        destructive:
          'border-transparent bg-danger-fill text-syntax-contract [a&]:hover:bg-danger-fill/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        success:
          'border-transparent bg-success-fill text-syntax-address [a&]:hover:bg-success-fill/90',
        danger:
          'border-transparent bg-danger-fill text-syntax-contract [a&]:hover:bg-danger-fill/90',
        outline:
          'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground border border-border',
        warning: 'bg-citrine-100 text-citrine-900 [a&]:hover:bg-citrine-100/90',
        accent:
          'border-transparent bg-accent-fill text-accent-text [a&]:hover:bg-accent-fill/90',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

const SoonBadge = () => (
  <Badge className="ml-auto text-smallcaps leading-none bg-message-warning-fill text-message-warning-text py-2 px-[10px]">
    Soon
  </Badge>
)

export { Badge, badgeVariants, SoonBadge }
