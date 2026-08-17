export const parseLocalizedNumber = (value: string): number | undefined => {
  const normalized = value.replace(',', '.').trim()
  if (
    !normalized ||
    normalized === '-' ||
    normalized === '.' ||
    normalized === '-.'
  ) {
    return undefined
  }
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? undefined : parsed
}
