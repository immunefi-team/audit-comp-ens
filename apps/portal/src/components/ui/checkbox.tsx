import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { CheckIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer flex items-center justify-center size-4 shrink-0 rounded-sm border shadow-xs transition-colors outline-none cursor-pointer',
        // unchecked (default)
        'bg-background border-border',
        // checked
        'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary',
        // disabled — unchecked
        'disabled:bg-sidebar disabled:border-secondary',
        // disabled — checked
        'disabled:data-[state=checked]:bg-border disabled:data-[state=checked]:border-border disabled:data-[state=checked]:text-muted-foreground',
        // focus
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        // invalid
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        // disabled cursor
        'disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
