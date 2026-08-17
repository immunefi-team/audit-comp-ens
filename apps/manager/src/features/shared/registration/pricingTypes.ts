import type { DomainAttributePillVariant } from '@/components/molecules/DomainResultCard/DomainAttributePill'

/**
 * Pricing quote for different tokens
 */
export type PricingQuote = {
  usdc?: number
  dai?: number
}

/**
 * Map of pricing quotes for each duration
 */
export type PricingQuoteMap = Record<number, PricingQuote>

/**
 * Premium label information
 */
export type PremiumLabel = {
  label: string
  variant: DomainAttributePillVariant
}

/**
 * Props for the main Pricing component
 */
export type PricingProps = {
  domainName: string
  duration: number
  isConnected: boolean
  isLoading?: boolean
  onSetDuration: (duration: number) => void
  onSelectPayment: (method: 'crypto' | 'credit-card') => void
  onSelectCrypto: (cryptoId: string) => void
  onConfirmPayment: (tokenPrice: bigint, selectedToken: string) => void
  onPricingDataChange?: (finalPrice: number, discountAmount: number) => void
}

export type PricingDuration = 1 | 3 | 5 | 10

export interface PricingOption {
  price: number
  discount: number
  label: string
  badge?: 'best'
  total?: number
}

export type PricingOptions = Record<PricingDuration, PricingOption>
