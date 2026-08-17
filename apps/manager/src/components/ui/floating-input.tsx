import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useId,
} from 'react'
import { cn } from '@/lib/utils'

export interface FloatingInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  labelSuffix?: ReactNode
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, labelSuffix, className, id, placeholder, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id || generatedId

    return (
      <div className={cn('relative', className)}>
        <input
          className={cn(
            'peer w-full min-w-0 rounded-sm border border-input bg-transparent px-4 py-4 text-base shadow-xs outline-none',
            'transition-[color,box-shadow]',
            'selection:bg-primary selection:text-primary-foreground',
            'placeholder:text-transparent focus:placeholder:text-muted-foreground',
            'focus-visible:border-ring',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            'md:text-sm',
          )}
          data-slot="input"
          id={inputId}
          placeholder={placeholder || ' '}
          ref={ref}
          {...props}
        />
        <label
          className={cn(
            'pointer-events-none absolute top-0 left-3 z-10 flex -translate-y-1/2 items-center gap-1 bg-background px-1 text-muted-foreground text-sm',
            'transition-all duration-200 ease-out',
            'peer-placeholder-shown:top-1/2 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-base',
            'peer-focus:top-0 peer-focus:bg-background peer-focus:text-sm',
            'peer-disabled:opacity-50',
          )}
          htmlFor={inputId}
        >
          {label}
          {labelSuffix}
        </label>
      </div>
    )
  },
)

FloatingInput.displayName = 'FloatingInput'
