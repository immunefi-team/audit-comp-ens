'use client'

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import type * as React from 'react'

import { cn } from '@/lib/utils'

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('grid gap-2', className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        'flex items-center justify-center size-5 shrink-0 rounded-full transition-colors outline-none cursor-pointer',
        // unchecked (default)
        'bg-border',
        // checked
        'data-[state=checked]:bg-primary',
        // hover — semi-transparent foreground overlay so it adapts in both
        // themes (darkens in light mode, lightens in dark mode)
        'hover:bg-foreground/15 data-[state=checked]:hover:bg-primary',
        // disabled — unchecked
        'disabled:bg-secondary disabled:hover:bg-secondary',
        // disabled — checked
        'disabled:data-[state=checked]:bg-border disabled:data-[state=checked]:hover:bg-border',
        // focus
        'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        // disabled cursor
        'disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center"
      >
        <div className="size-2 rounded-full bg-background" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
