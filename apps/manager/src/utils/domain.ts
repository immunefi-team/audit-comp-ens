/** Max bytes for a registerable name (UTF-8); emojis are multi-byte. */
export const MAX_DOMAIN_BYTES = 255

/** Truncate string to fit within maxBytes (UTF-8), safe at multi-byte boundaries. */
export function truncateToMaxBytes(
  str: string,
  maxBytes = MAX_DOMAIN_BYTES,
): string {
  return new TextDecoder()
    .decode(
      new TextEncoder().encode(str.slice(0, maxBytes)).subarray(0, maxBytes),
    )
    .replace(/\uFFFD+$/u, '')
}

/** UTF-8 byte length of string (for font scaling). */
export function getByteLength(str: string): number {
  return new TextEncoder().encode(str).length
}

const ETH_SUFFIX = '.eth'

/**
 * Normalize domain name from URL: add .eth if missing, truncate label to 255 bytes.
 * The 255-byte limit applies to the label only; .eth is appended and not counted.
 */
export function normalizeDomainNameFromUrl(name: string): string {
  if (!name || typeof name !== 'string') return ''
  const label = name.toLowerCase().endsWith(ETH_SUFFIX)
    ? name.slice(0, -ETH_SUFFIX.length)
    : name
  return truncateToMaxBytes(label, MAX_DOMAIN_BYTES) + ETH_SUFFIX
}

/** Breakpoints for domain byte length → font size (shared by header and card). */
const DOMAIN_LENGTH_TIERS = [30, 80, 150, 190] as const

function getDomainLengthTierIndex(length: number): number {
  const tiers = DOMAIN_LENGTH_TIERS
  for (let i = 0; i < tiers.length; i++) {
    const bound = tiers[i]
    if (bound !== undefined && length <= bound) return i
  }
  return tiers.length
}

/** Tailwind size classes per tier: header (large) and card (compact). */
const DOMAIN_HEADER_SIZE_CLASSES = [
  'text-5xl sm:text-6xl md:text-7xl',
  'text-3xl sm:text-4xl md:text-5xl',
  'text-xl sm:text-2xl md:text-3xl',
  'text-base sm:text-lg md:text-xl',
  'text-base sm:text-lg md:text-xl',
] as const

const DOMAIN_CARD_SIZE_CLASSES = [
  'text-xl',
  'text-base',
  'text-sm',
  'text-xs',
  'text-xs',
] as const

/** DomainCard (success/registration): ≤30 text-5xl, ≤150 text-4xl, ≤190+ text-3xl. */
const DOMAIN_CARD_DISPLAY_SIZE_CLASSES = [
  'text-5xl', // ≤30 bytes
  'text-4xl', // ≤80 bytes
  'text-4xl', // ≤150 bytes
  'text-3xl', // ≤190 bytes
  'text-3xl', // 191+ bytes
] as const

const HEADER_CLASSES = DOMAIN_HEADER_SIZE_CLASSES as readonly string[]
const CARD_CLASSES = DOMAIN_CARD_SIZE_CLASSES as readonly string[]
const CARD_DISPLAY_CLASSES =
  DOMAIN_CARD_DISPLAY_SIZE_CLASSES as readonly string[]

/** Font size for domain header: smaller as byte length increases. */
export function getDomainHeaderSizeClasses(length: number): string {
  const i = getDomainLengthTierIndex(length)
  return HEADER_CLASSES[i] ?? HEADER_CLASSES[HEADER_CLASSES.length - 1] ?? ''
}

/** Font size for domain card: same breakpoints, compact scale. */
export function getDomainCardSizeClasses(length: number): string {
  const i = getDomainLengthTierIndex(length)
  return CARD_CLASSES[i] ?? CARD_CLASSES[CARD_CLASSES.length - 1] ?? ''
}

/** Font size for DomainCard (success/registration): min text-sm. */
export function getDomainCardDisplaySizeClasses(length: number): string {
  const i = getDomainLengthTierIndex(length)
  return (
    CARD_DISPLAY_CLASSES[i] ??
    CARD_DISPLAY_CLASSES[CARD_DISPLAY_CLASSES.length - 1] ??
    ''
  )
}
