import { createLink } from '@tanstack/react-router'
import type { VariantProps } from 'class-variance-authority'
import React from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from './Button'

const BaseLinkButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<'a'> & VariantProps<typeof buttonVariants>
>(({ className, color, size, ...props }, ref) => {
  return (
    <a
      ref={ref}
      {...props}
      className={cn(buttonVariants({ color, size, className }))}
    />
  )
})

export const LinkButton = createLink(BaseLinkButton)
