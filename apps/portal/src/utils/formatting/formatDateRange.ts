/**
 * Formats a Date object to a localized date string with slashes
 * Format: MM/DD/YYYY (locale-dependent)
 *
 * @param date - Date to format
 * @returns Formatted date string with slashes, or undefined if date is undefined
 *
 * @example
 * formatDate(new Date('2021-01-15')) // "01/15/2021" (US locale)
 */
export const formatDate = (date?: Date): string | undefined => {
  if (!date) return undefined

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replace(/-/g, '/')
}

export type DateRange = {
  from?: Date
  to?: Date
}

/**
 * Creates a display label for a date range filter
 * Returns different formats based on which dates are set:
 * - Both dates: "MM/DD/YYYY - MM/DD/YYYY"
 * - From only: "From MM/DD/YYYY"
 * - To only: "Until MM/DD/YYYY"
 * - Neither: "All"
 *
 * @param dateRange - Object containing optional from and to dates
 * @returns Display string for the date range
 *
 * @example
 * getDateRangeLabel({ from: new Date('2021-01-01'), to: new Date('2021-12-31') })
 * // "01/01/2021 - 12/31/2021"
 *
 * getDateRangeLabel({ from: new Date('2021-01-01') })
 * // "From 01/01/2021"
 *
 * getDateRangeLabel({})
 * // "All"
 */
export const getDateRangeLabel = (dateRange: DateRange): string => {
  if (dateRange.from && dateRange.to) {
    return `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
  }
  if (dateRange.from) {
    return `From ${formatDate(dateRange.from)}`
  }
  if (dateRange.to) {
    return `Until ${formatDate(dateRange.to)}`
  }
  return 'All'
}
