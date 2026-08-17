import { formatExpiryDate } from '@/utils/formatting/formatDateTime'
import { unixSecondsToPlainDateUtc } from '@/utils/temporal'

/** Time of day, e.g. "1:32 PM" (UTC) — used in "initiated at {time}". */
export const formatTimelineTime = (unixSeconds: number): string =>
  Temporal.Instant.fromEpochMilliseconds(unixSeconds * 1000)
    .toZonedDateTimeISO('UTC')
    .toPlainTime()
    .toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

export const formatTimelineDate = (unixSeconds: number): string => {
  const date = unixSecondsToPlainDateUtc(unixSeconds)
  const today = Temporal.Now.plainDateISO('UTC')

  if (date.equals(today)) return 'Today'
  if (date.equals(today.subtract({ days: 1 }))) return 'Yesterday'
  return formatExpiryDate(date)
}
