import { forwardRef, type TextareaHTMLAttributes, useId } from 'react'
import { cn } from '@/lib/utils'

export interface FloatingTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

export const FloatingTextarea = forwardRef<
  HTMLTextAreaElement,
  FloatingTextareaProps
>(({ label, className, id, placeholder, ...props }, ref) => {
  const generatedId = useId()
  const textareaId = id || generatedId

  return (
    <div className={cn('relative', className)}>
      <textarea
        className={cn(
          'peer field-sizing-content min-h-24 w-full rounded-sm border border-input bg-transparent p-4 text-base shadow-xs outline-none',
          'transition-[color,box-shadow]',
          'selection:bg-primary selection:text-primary-foreground',
          'placeholder:text-transparent focus:placeholder:text-muted-foreground',
          'focus-visible:border-ring',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          'md:text-sm',
        )}
        data-slot="textarea"
        id={textareaId}
        placeholder={placeholder || ' '}
        ref={ref}
        {...props}
      />
      <label
        className={cn(
          'pointer-events-none absolute top-0 left-3 z-10 -translate-y-1/2 bg-background px-1 text-muted-foreground text-sm',
          'transition-all duration-200 ease-out',
          'peer-placeholder-shown:top-5 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-base',
          'peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:bg-background peer-focus:text-sm',
          'peer-disabled:opacity-50',
        )}
        htmlFor={textareaId}
      >
        {label}
      </label>
    </div>
  )
})

FloatingTextarea.displayName = 'FloatingTextarea'
