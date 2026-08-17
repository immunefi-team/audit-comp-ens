import { getDestinationContracts } from '@ens-apps/smart-account'
import { TaggedError } from '@ens-apps/utils/neverthrow'
import { sepolia } from 'viem/chains'
import { USDCIcon } from '@/components/atoms/StableCoinsIcons'

export class NameAvailabilityError extends TaggedError(
  'NameAvailabilityError',
)<{
  cause: unknown
}> {}

export type ValidationError =
  | { type: 'INVALID_CHARACTER'; message: string }
  | { type: 'TOO_SHORT'; message: string }
  | { type: 'INVALID_FORMAT'; message: string }
  | null

export const isNameAvailabilityError = (
  error: unknown,
): error is NameAvailabilityError => {
  return error instanceof NameAvailabilityError
}

export const getErrorMessage = (error: unknown): unknown => {
  if (isNameAvailabilityError(error)) {
    return error.cause
  }
  return error
}

export const normalizeQuery = (query: string): string => {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return ''
  return trimmed.endsWith('.eth') ? trimmed : `${trimmed}.eth`
}

/** The bare label of a 2LD: strips a trailing `.eth`, passes labels through. */
export const toLabel = (name: string): string =>
  name.toLowerCase().endsWith('.eth') ? name.slice(0, -4) : name

/**
 * Determines if a domain name is premium based on its length
 * Premium domains are 4 characters or less (excluding .eth)
 */
export const determinePremium = (name: string): boolean => {
  const normalized = name.trim().toLowerCase()
  const label = normalized.endsWith('.eth')
    ? normalized.replace('.eth', '')
    : normalized
  const labelLength = [...label].length
  return labelLength > 0 && labelLength <= 4
}

export type PremiumLabel = {
  label: string
  variant: 'premium-3' | 'premium-4'
}

/**
 * Gets the premium label information for a domain name
 * Returns undefined if the domain is not premium (more than 4 characters) or has no valid label
 */
export const getPremiumLabel = (
  domainName: string,
): PremiumLabel | undefined => {
  if (!determinePremium(domainName)) return undefined

  const name = domainName.includes('.')
    ? domainName.slice(0, domainName.lastIndexOf('.'))
    : domainName
  const length = [...name].length
  if (!length) return undefined

  const variant: 'premium-3' | 'premium-4' =
    length <= 3 ? 'premium-3' : 'premium-4'
  return {
    label: `${length} character premium name`,
    variant,
  } as const
}

/**
 * Validates an ENS domain name and returns a validation error if invalid.
 * Based on ENS naming rules:
 * - Minimum 3 characters for the label (excluding .eth)
 * - Allowed: letters, numbers, hyphens, emojis
 * - Not allowed: spaces, special characters like &, *, etc.
 * - No multiple consecutive dots
 */
export const validateENSName = (name: string): ValidationError => {
  const trimmed = name.trim()

  if (!trimmed) {
    return null
  }

  const hasEthSuffix = trimmed.toLowerCase().endsWith('.eth')
  const label = hasEthSuffix ? trimmed.slice(0, -4).trim() : trimmed.trim()

  if (trimmed.includes(' ')) {
    return {
      type: 'INVALID_FORMAT',
      message:
        "Something in the name isn't supported. Try letters, numbers, hyphens, or emojis with no spaces.",
    }
  }

  if (trimmed.includes('..')) {
    return {
      type: 'INVALID_FORMAT',
      message:
        "Something in the name isn't supported. Try letters, numbers, hyphens, or emojis with no spaces.",
    }
  }

  if (label.includes('.')) {
    return {
      type: 'INVALID_FORMAT',
      message:
        "Something in the name isn't supported. Try letters, numbers, hyphens, or emojis with no spaces.",
    }
  }

  const labelLength = [...label].length
  if (labelLength > 0 && labelLength < 3) {
    return {
      type: 'TOO_SHORT',
      message: 'Names must be 3 characters or more to register.',
    }
  }

  const invalidAsciiChars = /[&*@#$%^()[\]{}|\\:;"'<>?,=+~`!]/

  if (label.length > 0 && invalidAsciiChars.test(label)) {
    return {
      type: 'INVALID_CHARACTER',
      message:
        "That character isn't supported. Try letters, numbers, hyphens, or emojis.",
    }
  }

  return null
}

// Standalone-HCA payment tokens. The HCA validator only accepts the REAL
// Circle Sepolia USDC (its PAYMENT_TOKEN / SECONDARY_PAYMENT_TOKEN are both
// this address), so the picker offers USDC only — no mock USDC/DAI/USDT.
export const STABLECOINS = {
  USDC: {
    id: 'usdc',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    address: getDestinationContracts(sepolia.id).usdc,
    icon: USDCIcon,
  },
} as const
