import { useLingui } from '@lingui/react'
import { Plural, Trans } from '@lingui/react/macro'
import { cn } from '@/lib/utils'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'
import { tw } from '@/utils/tailwind'
import type { DurationPresetData } from './durationPresets'

const YEARLY_PRICE_STYLE = {
  citrine: tw`text-ens-citrine-500 bg-ens-citrine-100`,
  peridot: tw`text-ens-peridot-500 bg-ens-peridot-100`,
  garnet: tw`text-ens-garnet-500 bg-ens-garnet-100`,
} as const

export const DurationPresetRow = ({
  data,
  isSelected,
  price,
  onSelect,
}: {
  data: DurationPresetData
  isLoading: boolean
  price: number | undefined
  isSelected: boolean
  onSelect: () => void
}) => {
  const { _ } = useLingui()

  const yearlyPrice = price ? price / data.years : undefined

  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        'group relative flex w-full cursor-pointer flex-col gap-3 rounded-lg transition-all',
        'border border-[#DEDEDF] bg-neutral-50 px-3 py-4 hover:border-ens-lapis-900 aria-pressed:border-ens-lapis-900 md:px-5 md:py-5',
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-center gap-2">
        <span className="font-[425] text-base text-ens-quartz-900 md:text-2xl">
          {_(data.title)}
        </span>
        <span className="font-normal text-ens-quartz-400 text-xs italic md:text-base">
          {_(data.subtitle)}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <span className="font-normal text-base text-ens-quartz-900 leading-none tracking-tighter md:text-2xl">
          <Plural one="# year" other="# years" value={data.years} />
        </span>

        <div
          className={tw(
            YEARLY_PRICE_STYLE[data.color],
            'flex h-5 items-center justify-center rounded-full px-2 font-[450] text-xs',
          )}
        >
          <span>{yearlyPrice ? formatUsd(yearlyPrice) : '...'}/year</span>
        </div>

        <div className="ml-auto flex items-baseline gap-1 md:gap-1.5">
          <span className="font-medium font-mono text-ens-blue-dark text-xl leading-none tracking-tighter md:text-temp-32px">
            {price ? (
              formatUsd(price)
            ) : (
              <span className="animate-pulse">$...</span>
            )}
          </span>
          <span className="font-normal text-[#A0A4A6] text-xs leading-none tracking-tight md:text-base">
            <Trans>base price</Trans>
          </span>
        </div>
      </div>

      {data.kind === 'mostPopular' && (
        <div className="absolute -top-2 -left-1 flex h-5 items-center justify-center rounded-full bg-ens-lapis-900 px-2">
          <span className="font-[450] text-white text-xs">
            <Trans>Most popular</Trans>
          </span>
        </div>
      )}
    </button>
  )
}
