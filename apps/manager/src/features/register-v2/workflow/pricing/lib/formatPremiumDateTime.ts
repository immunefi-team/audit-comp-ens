/** Formats an epoch timestamp as local date + time for premium cooldown UI. */
export const formatPremiumDateTimeLocal = (epochMs: number): string =>
  new Date(epochMs).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

/** Short label for chart axis (e.g. "$100M"). */
export const formatPremiumAxisLabel = (valueUsd: number): string => {
  if (!Number.isFinite(valueUsd)) return '—'
  if (valueUsd >= 1_000_000) {
    const millions = valueUsd / 1_000_000
    return millions >= 10
      ? `$${Math.round(millions)}M`
      : `$${millions.toFixed(millions < 1 ? 2 : 0)}M`
  }
  if (valueUsd >= 1_000) {
    return `$${Math.round(valueUsd / 1_000)}K`
  }
  return `$${Math.round(valueUsd)}`
}
