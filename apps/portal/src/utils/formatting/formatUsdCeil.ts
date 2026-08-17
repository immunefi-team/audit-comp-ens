/**
 * Formats a number as USD with 2 decimal places (no rounding to whole dollars).
 *
 * @param value - Number to format
 * @returns Formatted USD string like "$5.00" or "$99.93", or "—" if not finite
 *
 * @example
 * formatUsd(5)      // "$5.00"
 * formatUsd(99.93)  // "$99.93"
 * formatUsd(NaN)    // "—"
 */
export const formatUsd = (value: number): string => {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Rounds a numeric string up to whole dollars and formats as USD.
 * Matches manager app pricing display (Math.ceil for consistency).
 *
 * @param value - Numeric string (e.g. from formatUnits)
 * @returns Formatted USD string like "$5" or "$100", or "—" if invalid
 *
 * @example
 * formatUsdCeil("5")      // "$5"
 * formatUsdCeil("99.93")  // "$100"
 * formatUsdCeil("")       // "—"
 */
export const formatUsdCeil = (value: string): string => {
  const num = Number.parseFloat(value)
  if (!Number.isFinite(num)) return '—'
  return formatUsd(Math.ceil(num))
}
