/**
 * Truncates a long ENS name for display, preserving the TLD at the end.
 *
 * @param name - The ENS name to truncate (e.g., "quasar-mist-silver-locked.eth")
 * @param maxLength - Maximum display length before truncation (default: 24)
 * @returns The truncated name, or the original if already within maxLength
 *
 * @example
 * truncateName("quasar-mist-silver-locked-resolver-locked.eth")
 * // "quasar-mist…r-locked.eth"
 *
 * truncateName("vitalik.eth")
 * // "vitalik.eth"
 */
export const truncateName = (name: string, maxLength = 24): string => {
  if (name.length <= maxLength) return name

  const lastDot = name.lastIndexOf('.')
  const tld = lastDot >= 0 ? name.slice(lastDot) : ''
  const label = lastDot >= 0 ? name.slice(0, lastDot) : name

  const available = maxLength - tld.length - 1 // 1 for '…'
  const prefixLen = Math.ceil(available / 2)
  const suffixLen = Math.floor(available / 2)

  if (prefixLen + suffixLen >= label.length) return name

  const suffix = suffixLen > 0 ? label.slice(-suffixLen) : ''
  return `${label.slice(0, prefixLen)}…${suffix}${tld}`
}
