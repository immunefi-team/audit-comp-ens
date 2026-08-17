import { Trans } from '@lingui/react/macro'
import { MSymbol } from '@/components/ui/material-symbol'
import { isFeatureEnabled } from '@/utils/feature-flags'
import { tw } from '@/utils/tailwind'
import { PriceCooldownDecayChart } from './PriceCooldownDecayChart'
import type { PriceCooldownDemand, PriceCooldownInfo } from './types'
import type { PriceCooldownChartSelection } from './usePriceCooldownChartSelection'

type PriceCooldownExpandedContentProps = {
  basePricePerYearLabel: string
  cooldown: PriceCooldownInfo
  demand?: PriceCooldownDemand
  selection: PriceCooldownChartSelection
}

const hasDemandStatsData = (demand?: PriceCooldownDemand) => {
  const { favoriteCount, searchCount30d } = demand ?? {}
  return favoriteCount !== undefined || searchCount30d !== undefined
}

const DemandStats = ({ demand }: { demand?: PriceCooldownDemand }) => {
  const nameStatsEnabled = isFeatureEnabled('TEMP_PREMIUM_NAME_STATS')
  if (!nameStatsEnabled || !hasDemandStatsData(demand)) {
    return null
  }

  const { favoriteCount, searchCount30d } = demand ?? {}

  return (
    <div className="flex flex-col gap-2 text-ens-lapis-900 md:flex-row md:flex-wrap md:gap-3">
      {favoriteCount !== undefined && (
        <div className="flex items-center gap-1.5">
          <MSymbol
            className="ms-fill ms-opsz-16 ms-wght-300"
            symbol="favorite"
          />
          <span className="font-mono text-sm uppercase">{favoriteCount}</span>
          <span className="font-medium text-ens-lapis-900 text-xs md:text-sm">
            <Trans>people have favorited this name</Trans>
          </span>
        </div>
      )}
      {searchCount30d !== undefined && (
        <div className="flex items-center gap-1.5">
          <MSymbol className="ms-opsz-16 ms-wght-300" symbol="search" />
          <span className="font-mono text-sm uppercase">{searchCount30d}</span>
          <span className="font-medium text-ens-lapis-900 text-xs md:text-sm">
            <Trans>unique searches in the last 30 days</Trans>
          </span>
        </div>
      )}
    </div>
  )
}

const BuyNowOrWaitSection = ({
  periodDays,
  demand,
}: {
  periodDays: number
  demand?: PriceCooldownDemand
}) => {
  const nameStatsEnabled = isFeatureEnabled('TEMP_PREMIUM_NAME_STATS')
  const showDemandStats = nameStatsEnabled && hasDemandStatsData(demand)

  return (
    <div className="flex flex-col gap-2 md:gap-4">
      <p className="text-[#353535] text-sm leading-normal md:text-base">
        <Trans>Should I register now or wait?</Trans>
      </p>
      <p className="text-[#3f3f3e] text-xs leading-normal md:text-sm">
        <Trans>
          You can buy this name at any point during the {periodDays}-day
          cooldown.
        </Trans>{' '}
        {showDemandStats ? (
          <Trans>
            Some names are more in-demand than others — the stats below can help
            you decide whether to act soon or wait.
          </Trans>
        ) : (
          <Trans>Some names are more in-demand than others.</Trans>
        )}
      </p>
      <DemandStats demand={demand} />
    </div>
  )
}

const TargetPriceField = ({
  basePricePerYearLabel,
  selection,
  timezoneLabel,
}: {
  basePricePerYearLabel: string
  selection: PriceCooldownChartSelection
  timezoneLabel: string
}) => {
  const {
    targetPriceInput,
    handleTargetPriceInputChange,
    handleTargetPriceInputBlur,
    targetPriceReachLabel,
  } = selection

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="font-normal text-ens-quartz-700 text-sm tracking-tight md:text-base">
        <span className="md:hidden">
          <Trans>
            Enter a price you&apos;d be willing to pay. We&apos;ll calculate
            when the fee will reach that price.
          </Trans>
        </span>
        <span className="hidden md:inline">
          <Trans>What additional fee are you willing to pay?</Trans>
        </span>
      </p>
      <label
        className={tw(
          'flex h-12 w-full cursor-text items-center gap-2 overflow-hidden',
          'rounded border border-ens-quartz-200 bg-white px-4',
          'focus-within:border-ens-lapis-400',
        )}
      >
        <span className="text-ens-quartz-900 text-sm">$</span>
        <input
          className={tw(
            'min-w-[2ch] flex-initial [field-sizing:content]',
            'border-0 bg-transparent p-0 text-ens-quartz-900 text-sm outline-none',
            'placeholder:text-ens-quartz-360',
          )}
          inputMode="decimal"
          onBlur={handleTargetPriceInputBlur}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.,]/g, '')
            handleTargetPriceInputChange(raw)
          }}
          placeholder="0"
          type="text"
          value={targetPriceInput}
        />
        {basePricePerYearLabel && (
          <span className="select-none text-ens-quartz-400 text-sm">
            + {basePricePerYearLabel} base price
          </span>
        )}
      </label>
      {targetPriceReachLabel && (
        <p className="text-ens-quartz-400 text-xs leading-normal md:text-sm">
          {targetPriceReachLabel}
        </p>
      )}
      <p className="text-ens-quartz-400 text-xs leading-5">
        <Trans>Times shown in your local time zone ({timezoneLabel})</Trans>
      </p>
    </div>
  )
}

export const PriceCooldownExpandedContent = ({
  basePricePerYearLabel,
  cooldown,
  demand,
  selection,
}: PriceCooldownExpandedContentProps) => {
  const {
    premiumEndsAtLabel,
    periodDays = 21,
    timezoneLabel,
    premiumStartDate,
    nowPoint,
  } = cooldown

  const chartProps = {
    nowPoint,
    onSelectedPointChange: selection.handleSelectedPointChange,
    premiumStartDate,
    selectedPoint: selection.selectedPoint,
    selectedDisplayPrice: selection.selectedDisplayPrice,
  }

  return (
    <div className="flex w-full flex-col gap-5 md:gap-10">
      <div className="flex flex-col gap-3 md:hidden">
        <p className="font-normal text-[#353535] text-sm">
          <Trans>How it works</Trans>
        </p>
        <p className="text-[#3f3f3e] text-xs leading-normal">
          <Trans>
            When a name expires, a temporary fee is added on top of its base
            price to prevent instant sniping by bots. The fee starts at an
            intentionally high price ($100M) and drops continuously toward $0
            over {periodDays} days.
          </Trans>
        </p>
        <p className="text-ens-quartz-400 text-sm">
          <Trans>The fee hits $0 on</Trans>{' '}
          <span className="text-ens-lapis-900">{premiumEndsAtLabel}</span>
        </p>
        <PriceCooldownDecayChart compact {...chartProps} />
        <TargetPriceField
          basePricePerYearLabel={basePricePerYearLabel}
          selection={selection}
          timezoneLabel={timezoneLabel}
        />
        <div
          className={tw(
            'rounded-xl border-[#80c4e0] border-[0.5px] bg-[#effafe] p-4',
          )}
        >
          <BuyNowOrWaitSection demand={demand} periodDays={periodDays} />
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-2 md:items-start md:gap-x-10 md:gap-y-6">
        <div className="flex min-w-0 flex-col gap-6">
          <BuyNowOrWaitSection demand={demand} periodDays={periodDays} />
          <TargetPriceField
            basePricePerYearLabel={basePricePerYearLabel}
            selection={selection}
            timezoneLabel={timezoneLabel}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3 self-start">
          <p className="text-ens-quartz-400 text-sm leading-normal">
            <Trans>The fee hits $0 on</Trans>{' '}
            <span className="text-ens-lapis-900">{premiumEndsAtLabel}</span>
          </p>
          <PriceCooldownDecayChart {...chartProps} />
        </div>
      </div>
    </div>
  )
}
