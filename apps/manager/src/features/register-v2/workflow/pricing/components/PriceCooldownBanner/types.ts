/** Fee pill row (base price + decaying premium). */
export type PriceCooldownFees = {
  basePricePerYearLabel: string
  currentPremiumLabel: string
  /** Live USD value for the animated pill. Falls back to currentPremiumLabel. */
  currentPremiumValue?: number
}

/** Cooldown timing: header copy, decay chart, and "fee hits $0" copy. */
export type PriceCooldownInfo = {
  premiumEndsAtLabel: string
  periodDays?: number
  timezoneLabel: string
  premiumStartDate: Date
  nowPoint: number
}

/** Optional engagement stats shown in the "buy now or wait?" section. */
export type PriceCooldownDemand = {
  favoriteCount?: number
  searchCount30d?: number
}

export type PriceCooldownBannerProps = {
  fees: PriceCooldownFees
  cooldown: PriceCooldownInfo
  demand?: PriceCooldownDemand
  className?: string
  /** Storybook: force expanded state */
  defaultExpanded?: boolean
}
