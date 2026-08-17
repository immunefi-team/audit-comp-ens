import type * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-7 w-full min-w-0 items-center rounded-sm bg-secondary px-2 text-base text-foreground outline-none transition-colors md:text-sm',
        'placeholder:text-muted-foreground',
        'selection:bg-primary selection:text-primary-foreground',
        'file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-2 aria-invalid:ring-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
