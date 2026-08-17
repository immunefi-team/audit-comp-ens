import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useState } from 'react'
import { buildPriceCooldownBannerProps } from '../../lib/buildPriceCooldownBannerProps'
import {
  getPremiumPriceAtInstant,
  type PremiumDecayConfig,
} from '../../lib/premiumDecay'
import {
  PREMIUM_DURATION_MS,
  PREMIUM_RESOLUTION,
} from '../temporary-premium/TemporaryPremiumChart'
import { PriceCooldownBanner } from './PriceCooldownBanner'
import type { PriceCooldownDemand } from './types'
import { useTickingNowMs } from './useTickingNowMs'

// Mirrors the on-chain StandardRentPriceOracle params the app fetches via
// getOracleParamsQueryOptions, matching the chart's hardcoded curve:
// $100M start price, daily halving, 21-day window.
const MS_PER_DAY = 24 * 60 * 60 * 1000
const MOCK_PREMIUM_DECAY: PremiumDecayConfig = {
  halvingPeriodMs: MS_PER_DAY,
  periodMs: PREMIUM_DURATION_MS,
  startPriceUsd: 100_000_000,
}

// Matches the $8/year mock used in duration/payment stories for temp premium.
const MOCK_BASE_PRICE_PER_YEAR_USD = 8

// How far into the 21-day window the story starts.
const MOCK_WINDOW_PROGRESS = 0.22

type LivePriceCooldownBannerProps = {
  demand?: PriceCooldownDemand
  defaultExpanded?: boolean
}

/**
 * Live harness copied from `PriceCooldownBannerSection`, minus the
 * react-query/xstate data layer: same props builder, ticking clock,
 * fractional `nowPoint`, and per-second premium recomputation — so the
 * story exercises exactly the temp-premium code paths the app uses.
 */
const LivePriceCooldownBanner = ({
  demand,
  defaultExpanded,
}: LivePriceCooldownBannerProps) => {
  // Anchor the cooldown window once on mount (the section anchors per
  // label+duration); the chart's x-axis must not crawl between renders.
  const [premiumStartDate] = useState(
    () =>
      new Date(
        Math.round(Date.now() - MOCK_WINDOW_PROGRESS * PREMIUM_DURATION_MS),
      ),
  )

  const nowMs = useTickingNowMs(1_000)

  // Fractional point — integer rounding would freeze the dot for ~28s.
  const elapsedMs = nowMs - premiumStartDate.getTime()
  const nowPoint = (elapsedMs / PREMIUM_DURATION_MS) * PREMIUM_RESOLUTION

  const liveCurrentPremiumUsd = getPremiumPriceAtInstant(
    premiumStartDate.getTime(),
    nowMs,
    MOCK_PREMIUM_DECAY,
  )

  const bannerData = buildPriceCooldownBannerProps({
    basePricePerYearUsd: MOCK_BASE_PRICE_PER_YEAR_USD,
    premiumDecay: MOCK_PREMIUM_DECAY,
    premiumUsd: liveCurrentPremiumUsd,
  })
  if (!bannerData?.show) return null

  return (
    <PriceCooldownBanner
      cooldown={{ ...bannerData.props.cooldown, nowPoint, premiumStartDate }}
      defaultExpanded={defaultExpanded}
      demand={demand}
      fees={{
        ...bannerData.props.fees,
        currentPremiumValue: liveCurrentPremiumUsd,
      }}
    />
  )
}

const meta = {
  title: 'Register v2/Pricing/Price cooldown/Banner',
  component: LivePriceCooldownBanner,
  parameters: {
    layout: 'padded',
  },
  args: {
    demand: {
      favoriteCount: 425,
      searchCount30d: 40,
    },
  },
} satisfies Meta<typeof LivePriceCooldownBanner>

export default meta

type Story = StoryObj<typeof meta>

export const DesktopCollapsed: Story = {
  parameters: {
    viewport: { defaultViewport: 'desktop' },
  },
}

export const DesktopExpanded: Story = {
  args: {
    defaultExpanded: true,
  },
  parameters: {
    viewport: { defaultViewport: 'desktop' },
  },
}

export const MobileCollapsed: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
}

export const MobileExpanded: Story = {
  args: {
    defaultExpanded: true,
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
}
