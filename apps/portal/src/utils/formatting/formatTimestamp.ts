/**
 * Formats a Unix timestamp (in seconds) to a human-readable date/time string
 * Format: YYYY/MM/DD HH:MM:SS
 *
 * @param timestamp - Unix timestamp in seconds (as bigint)
 * @returns Formatted date string in UTC, or null if timestamp is undefined
 *
 * @example
 * formatTimestamp(1609459200n) // "2021/01/01 00:00:00"
 */
export const formatTimestamp = (timestamp?: bigint): string | null => {
  if (!timestamp) return null

  return new Date(Number(timestamp) * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\..+/, '')
    .replace(/-/g, '/')
}

/**
 * Formats a Unix timestamp (in seconds) to a long-form date string in UTC.
 * Format: "Month DD, YYYY" (e.g. "October 25, 2025")
 *
 * @param timestamp - Unix timestamp in seconds (as bigint or number)
 * @returns Formatted date string, or null if timestamp is undefined
 *
 * @example
 * formatTimestampDate(1761350400n) // "October 25, 2025"
 */
export const formatTimestampDate = (
  timestamp?: bigint | number,
): string | null => {
  if (!timestamp) return null

  return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
