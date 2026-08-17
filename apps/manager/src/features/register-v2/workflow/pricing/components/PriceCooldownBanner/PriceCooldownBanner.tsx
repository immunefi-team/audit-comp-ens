import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { MSymbol } from '@/components/ui/material-symbol'
import { tw } from '@/utils/tailwind'
import { PriceCooldownBannerHeader } from './PriceCooldownBannerHeader'
import { PriceCooldownExpandedContent } from './PriceCooldownExpandedContent'
import { PriceCooldownFeePills } from './PriceCooldownFeePills'
import type { PriceCooldownBannerProps } from './types'
import { usePriceCooldownChartSelection } from './usePriceCooldownChartSelection'

export const PriceCooldownBanner = ({
  fees,
  cooldown,
  demand,
  className,
  defaultExpanded = false,
}: PriceCooldownBannerProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const selection = usePriceCooldownChartSelection(
    cooldown.premiumStartDate,
    cooldown.nowPoint,
  )

  return (
    <section
      className={tw(
        'price-cooldown-banner flex flex-col gap-4 overflow-hidden rounded border border-ens-lapis-100 bg-ens-lapis-tint p-4',
        className,
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PriceCooldownBannerHeader periodDays={cooldown.periodDays ?? 21} />
        <div className="hidden shrink-0 md:block">
          <div className="flex gap-4">
            <PriceCooldownFeePills {...fees} layout="desktop" />
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <PriceCooldownFeePills {...fees} layout="mobile" />
      </div>

      <button
        className={tw(
          'flex w-full items-center justify-center gap-1.5 border-ens-lapis-100 border-t pt-3',
          'font-medium font-mono text-ens-lapis-500 uppercase tracking-wider',
          'text-xs md:text-sm',
        )}
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        {expanded ? <Trans>Show less</Trans> : <Trans>How it works</Trans>}
        <MSymbol
          className={tw(
            'ms-opsz-14 ms-wght-500 transition-transform',
            expanded ? 'rotate-180' : '',
          )}
          symbol="keyboard_arrow_down"
        />
      </button>

      {/* Smooth expand/collapse via animated grid rows (animates to height
          auto without JS measuring) + an opacity fade. The collapsed content
          stays mounted but is marked inert so it isn't tab-focusable. */}
      <div
        className={tw(
          'grid transition-all duration-300 ease-out motion-reduce:transition-none',
          expanded
            ? 'grid-rows-[1fr] opacity-100'
            : '-mt-4 grid-rows-[0fr] opacity-0',
        )}
        inert={!expanded}
      >
        <div className="overflow-hidden">
          <PriceCooldownExpandedContent
            basePricePerYearLabel={fees.basePricePerYearLabel}
            cooldown={cooldown}
            demand={demand}
            selection={selection}
          />
        </div>
      </div>
    </section>
  )
}
