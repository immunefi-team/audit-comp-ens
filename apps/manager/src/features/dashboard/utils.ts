const dashboardDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export const NON_EXPIRING_DATE_LABEL = 'Does not expire'

const hasValidDate = (value?: Date | null): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime())

export const formatDashboardDate = (value?: Date | null): string => {
  if (!hasValidDate(value)) return '—'

  try {
    return dashboardDateFormatter.format(value)
  } catch {
    return '—'
  }
}

const ONE_DAY_MS = 1000 * 60 * 60 * 24

export const getDaysUntil = (value?: Date | null): number | null => {
  if (!hasValidDate(value)) return null

  return Math.ceil((value.getTime() - Date.now()) / ONE_DAY_MS)
}

export const isExpiringSoon = (
  value?: Date | null,
  thresholdDays = 30,
  daysUntilOverride?: number | null,
): boolean => {
  const daysUntil = daysUntilOverride ?? getDaysUntil(value)

  if (daysUntil === null) return false

  return daysUntil > 0 && daysUntil <= thresholdDays
}

export const resolveDomainLabel = (domain: {
  id: string
  name?: string | null
  normalizedName?: string | null
}): string => domain.name ?? domain.normalizedName ?? domain.id

export const toDateFromSeconds = (value?: number | null): Date | null =>
  typeof value === 'number' ? new Date(value * 1000) : null
