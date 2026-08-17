import { Slot } from '@radix-ui/react-slot'
import { createLink } from '@tanstack/react-router'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  cn(
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xs',
    'font-mono text-sm outline-none',
    'transition-all',
    'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
    'disabled:pointer-events-none disabled:opacity-50',
    'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        default:
          'h-[56px] w-[191px] items-center justify-center gap-4 rounded-xs border bg-ens-blue px-6 py-6 text-white',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        connectWallet:
          'h-[56px] w-[191px] items-center justify-center gap-4 rounded-xs border bg-ens-blue px-6 py-[27px] text-white',
        payment:
          'h-[56px] w-[191px] items-center justify-center gap-4 rounded-md border bg-ens-blue px-6 py-8 text-white uppercase',
        lightBlue:
          'bg-[#A9D5ED] text-ens-lapis-dense hover:bg-ens-lapis-surface active:bg-[#649EBE] disabled:cursor-not-allowed disabled:bg-[#EDEDED] disabled:text-[#7D7D7D] disabled:opacity-100',
        blue: 'bg-ens-lapis-core text-ens-white hover:bg-[#026B9C] active:bg-[#024B6E] disabled:cursor-not-allowed disabled:bg-[#EDEDED] disabled:text-[#7D7D7D] disabled:opacity-100',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-fit rounded-md px-4 py-4 text-xs has-[>svg]:px-4',
        xl: 'rounded-md px-4 py-6 text-sm',
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
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      {...props}
    />
  )
}

const BaseLinkButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<'a'> & VariantProps<typeof buttonVariants>
>(({ className, variant, size, ...props }, ref) => {
  return (
    <a
      ref={ref}
      {...props}
      className={cn(buttonVariants({ variant, size, className }))}
    />
  )
})

const LinkButton = createLink(BaseLinkButton)

export { Button, buttonVariants, LinkButton }
