/**
 * Truncates an Ethereum address or transaction hash for display
 *
 * @param value - The address or hash to truncate (e.g., "0x1234...abcd")
 * @param startChars - Number of characters to show at the start (default: 6, includes "0x")
 * @param endChars - Number of characters to show at the end (default: 4)
 * @param separator - The separator to use between start and end (default: "…")
 * @returns The truncated string
 *
 * @example
 * truncateAddress("0x1234567890abcdef1234567890abcdef12345678")
 * // "0x1234…5678"
 *
 * truncateAddress("0x1234567890abcdef1234567890abcdef12345678", 10, 6)
 * // "0x12345678…345678"
 */
export const truncateAddress = (
  value: string,
  startChars: number = 6,
  endChars: number = 4,
  separator: string = '…',
): string => {
  if (value.length <= startChars + endChars) {
    return value
  }

  return `${value.slice(0, startChars)}${separator}${value.slice(-endChars)}`
}
