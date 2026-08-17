import { cva } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface FilterChipDef<T extends string> {
  readonly value: T
  readonly label: ReactNode
  readonly count?: number
  readonly disabled?: boolean
  readonly activeClassName?: string
  readonly activeCountClassName?: string
}

interface FilterChipsProps<T extends string> {
  readonly value: T
  readonly chips: readonly FilterChipDef<T>[]
  readonly onChange: (value: T) => void
}

const chipVariants = cva(
  'flex h-8 shrink-0 items-center gap-1 rounded-sm px-1.5 py-1 font-semi-mono text-sm uppercase leading-[1.05] tracking-[0.28px] disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      active: {
        true: 'bg-ens-quartz-250 text-ens-quartz-900',
        false: 'bg-ens-quartz-75 text-ens-quartz-400 hover:bg-ens-quartz-100',
      },
    },
  },
)

const chipCountVariants = cva(
  'inline-flex h-[19.68px] items-center justify-center rounded-sm px-[6.56px] py-[1.64px] font-sans text-[11.48px] leading-[1.05] tracking-[0.2296px]',
  {
    variants: {
      active: {
        true: 'bg-white text-ens-quartz-500',
        false: 'bg-ens-quartz-150 text-ens-quartz-400',
      },
    },
  },
)

export const FilterChips = <T extends string>({
  value,
  chips,
  onChange,
}: FilterChipsProps<T>) => (
  <div className="flex flex-wrap items-center gap-3">
    {chips.map((chip) => {
      const isActive = chip.value === value

      return (
        <button
          aria-pressed={isActive}
          className={cn(
            chipVariants({ active: isActive }),
            isActive && chip.activeClassName,
          )}
          disabled={chip.disabled}
          key={chip.value}
          onClick={() => onChange(chip.value)}
          type="button"
        >
          <span>{chip.label}</span>
          {chip.count !== undefined && chip.count > 0 && (
            <span
              className={cn(
                chipCountVariants({ active: isActive }),
                isActive && chip.activeCountClassName,
              )}
            >
              {chip.count}
            </span>
          )}
        </button>
      )
    })}
  </div>
)
