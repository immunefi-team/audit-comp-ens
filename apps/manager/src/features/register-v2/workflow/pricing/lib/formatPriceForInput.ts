/** Formats a number for premium target price inputs (e.g. "7,680,717.20"). */
export function formatPriceForInput(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
