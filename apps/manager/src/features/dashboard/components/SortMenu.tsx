import { Trans } from '@lingui/react/macro'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MSymbol } from '@/components/ui/material-symbol'
import { cn } from '@/lib/utils'

type SortDirection = 'asc' | 'desc'

export interface SortOption<T extends string> {
  readonly value: T
  readonly label: ReactNode
  readonly triggerLabel?: ReactNode
}

interface SortMenuProps<T extends string> {
  readonly value: T
  readonly options: readonly SortOption<T>[]
  readonly onChange: (value: T) => void
  readonly direction?: SortDirection
  readonly onToggleDirection?: () => void
}

export const SortMenu = <T extends string>({
  value,
  options,
  onChange,
  direction,
  onToggleDirection,
}: SortMenuProps<T>) => {
  const active = options.find((option) => option.value === value)
  const arrowIcon = (
    <span className="flex size-6 flex-col items-center justify-center px-[6.15px]">
      <ChevronDown
        className={cn(
          'size-[12.3px] rotate-180 text-ens-quartz-400',
          direction === 'asc' && 'text-[#232222]',
        )}
        strokeWidth={2.5}
      />
      <ChevronDown
        className={cn(
          'size-[12.3px] text-ens-quartz-400',
          direction === 'desc' && 'text-[#232222]',
        )}
        strokeWidth={2.5}
      />
    </span>
  )

  return (
    <div className="flex h-8 min-w-43.5 shrink-0 items-center rounded-full font-sans text-[#232222] text-sm leading-[1.05] tracking-[0.28px] md:text-base md:tracking-[0.32px]">
      {onToggleDirection ? (
        <button
          aria-label="Toggle sort direction"
          className="flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ens-lapis-500"
          onClick={onToggleDirection}
          type="button"
        >
          {arrowIcon}
        </button>
      ) : (
        arrowIcon
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex h-8 min-w-0 flex-1 items-center justify-between gap-1 rounded-full pr-2 outline-none focus-visible:ring-2 focus-visible:ring-ens-lapis-500"
            type="button"
          >
            <span className="whitespace-nowrap leading-[1.05]">
              <Trans>Sort by</Trans> {active?.triggerLabel ?? active?.label}
            </span>
            <MSymbol
              className="ms-opsz-24 ms-wght-300 shrink-0 text-2xl text-[#232222] leading-none"
              symbol="keyboard_arrow_down"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuRadioGroup
            onValueChange={(next) => onChange(next as T)}
            value={value}
          >
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
