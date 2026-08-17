import { useLingui } from '@lingui/react/macro'
import { Loader2, Search, X } from 'lucide-react'
import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface SearchFieldProps
  extends InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string
  onSearch?: (value: string) => void
  wrapperClassName?: string
  isLoading?: boolean
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      onSearch,
      className,
      wrapperClassName,
      onKeyDown,
      onChange,
      isLoading,
      value,
      ...props
    },
    ref,
  ) => {
    const { t } = useLingui()
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && onSearch) {
        onSearch(event.currentTarget.value)
      }
      onKeyDown?.(event)
    }

    const hasValue =
      typeof value === 'string' ? (value?.length ?? 0) > 0 : Boolean(value)

    const handleClear = () => {
      onChange?.({
        target: { value: '' },
      } as React.ChangeEvent<HTMLInputElement>)
    }

    return (
      <div
        className={cn(
          'relative flex items-center gap-[15px]',
          wrapperClassName,
        )}
      >
        <input
          className={cn(
            'size-full self-stretch',
            'font-sans font-semibold text-xl leading-[110%] tracking-[-0.4px]',
            'py-[21px] pr-7 pl-13',
            'data-[loading=true]:pr-14',
            hasValue && !isLoading && 'pr-14',
            'rounded border-[0.25px] border-ens-gray-two',
            'bg-ens-white text-ens-blue',
            'shadow-md',
            'transition-all duration-200 ease-in-out',
            'placeholder:text-ens-lapis-surface',
            'focus:border-transparent focus:outline-none',
            'focus:ring-2 focus:ring-blue-500/20',
            'disabled:cursor-not-allowed',
            className,
          )}
          data-loading={isLoading || undefined}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          ref={ref}
          type="text"
          {...(value !== undefined && { value })}
          {...props}
        />
        <Search
          aria-hidden
          className="absolute top-1/2 left-4.5 size-6.5 -translate-y-1/2 text-ens-lapis-dust"
          strokeWidth={2.15}
        />

        {isLoading && (
          <Loader2
            aria-hidden
            className="absolute top-1/2 right-4.5 size-6.5 -translate-y-1/2 animate-spin text-ens-lapis-dust"
            strokeWidth={2.15}
          />
        )}

        {hasValue && !isLoading && (
          <button
            aria-label={t`Clear search`}
            className="absolute top-1/2 right-4.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ens-lapis-surface transition-colors hover:bg-ens-gray-two/50 hover:text-ens-blue-midnight"
            onClick={handleClear}
            type="button"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        )}
      </div>
    )
  },
)

SearchField.displayName = 'SearchField'
