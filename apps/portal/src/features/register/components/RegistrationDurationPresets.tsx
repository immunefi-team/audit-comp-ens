import { useQueries } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import { getAppliedDiscountQueryOptions } from '@/features/register/hooks/useAppliedDiscount'
import { useBaseRate } from '@/features/register/hooks/useBaseRate'
import { getSavingsPct } from '@/features/register/utils/registrationPrice'
import { CONTRACT_SECONDS_PER_YEAR } from '@/lib/constants/duration'
import { ORACLE_PRICE_DECIMALS } from '@/lib/constants/oracle'
import { cn } from '@/lib/utils'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'

export const PRESET_YEARS = [1, 2, 3, 6] as const

const PRESET_DURATIONS_SECONDS = PRESET_YEARS.map(
  (years) => years * CONTRACT_SECONDS_PER_YEAR,
)

/**
 * Contract-equivalent effective $/year for a given duration. `discountedBase`
 * is `applyDiscount(baseRate × duration, duration)` straight from the oracle
 * (the full discounted base for the term); per-year is just `/ years`.
 */
const computeEffectivePerYear = (
  discountedBase: bigint,
  years: number,
): number => {
  if (discountedBase <= 0n || years <= 0) return 0
  const perYearUnits = discountedBase / BigInt(years)
  return Number(formatUnits(perYearUnits, ORACLE_PRICE_DECIMALS))
}

type RegistrationDurationPresetsProps = {
  readonly value: number
  readonly onSelect: (years: number) => void
  /** Name used to look up the per-character base rate. Chips hidden if absent. */
  readonly name?: string
}

export const RegistrationDurationPresets = ({
  value,
  onSelect,
  name,
}: RegistrationDurationPresetsProps) => {
  const selectedYears = PRESET_YEARS.includes(
    value as (typeof PRESET_YEARS)[number],
  )
    ? value
    : undefined

  const baseRate = useBaseRate(name ?? '')
  const discountQueries = useQueries({
    queries: PRESET_DURATIONS_SECONDS.map((duration) =>
      getAppliedDiscountQueryOptions({
        value: baseRate * BigInt(duration),
        duration,
      }),
    ),
  })

  const effectivePerYear = PRESET_YEARS.map((years, idx) =>
    computeEffectivePerYear(discountQueries[idx]?.data ?? 0n, years),
  )

  const baselinePerYear = effectivePerYear[0]

  return (
    <div className="flex flex-wrap sm:flex-row flex-col gap-4">
      {PRESET_YEARS.map((years, idx) => {
        const isSelected = selectedYears === years
        const effective = effectivePerYear[idx]
        const discountPct = getSavingsPct(effective, baselinePerYear)

        return (
          <button
            key={years}
            type="button"
            onClick={() => onSelect(years)}
            aria-pressed={isSelected}
            className={cn(
              'relative group sm:w-24 w-full flex sm:flex-col items-center justify-center sm:gap-0.5 gap-2 rounded-sm border px-3 py-2.5 text-left transition-colors cursor-pointer',
              isSelected
                ? 'border-signal-success-700 bg-success-fill'
                : 'border-border hover:border-neutral-6',
            )}
          >
            {discountPct > 0 ? (
              <span
                className={cn(
                  'absolute sm:top-0 sm:-right-1 top-1/2 -translate-y-1/2 right-4 rounded-full px-1.5 py-1.5 text-[10px] font-medium leading-none',
                  isSelected
                    ? 'bg-signal-success-700 text-white'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {`-${discountPct}%`}
              </span>
            ) : null}
            <span
              className={cn(
                'text-sm',
                isSelected
                  ? 'text-success-text'
                  : 'text-muted-foreground group-hover:text-foreground',
              )}
            >
              {years === 1 ? '1 year' : `${years} years`}
            </span>
            <span
              className={cn(
                'text-base font-medium',
                isSelected
                  ? 'text-success-text'
                  : 'text-muted-foreground group-hover:text-foreground',
              )}
            >
              {effective > 0 ? (
                <>
                  {formatUsd(effective)}
                  <span
                    className={cn(
                      'font-normal',
                      isSelected
                        ? 'text-success-text'
                        : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    /yr
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
