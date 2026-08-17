/**
 * UI boundary adapters — convert between Temporal types and native Date objects.
 *
 * The rest of the app uses Temporal types natively (Temporal.Instant for absolute
 * moments, Temporal.PlainDate for calendar dates). Only convert to Date where
 * external libraries require it (react-day-picker, Intl formatters).
 */

/** Convert a Temporal.Instant to a Date for react-day-picker or Intl APIs. */
export const instantToDate = (instant: Temporal.Instant): Date =>
  new Date(instant.epochMilliseconds)

/** Convert a Temporal.PlainDate to a Date for react-day-picker month/selection props. */
export const plainDateToDate = (plain: Temporal.PlainDate): Date =>
  new Date(plain.year, plain.month - 1, plain.day)

/** Convert a Date from react-day-picker's disabled callback to Temporal.PlainDate. */
export const dateToPlainDate = (date: Date): Temporal.PlainDate =>
  Temporal.PlainDate.from({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  })

/**
 * Convert a Unix timestamp (seconds) to a Temporal.PlainDate in UTC.
 *
 * Use for on-chain timestamps (expiry, registration) whose calendar day must
 * match the contract value for every viewer. Do NOT route these through
 * `dateToPlainDate` — that reads the local calendar day and shifts the date
 * for users west of UTC (e.g. a UTC-midnight expiry shows as the day before).
 */
export const unixSecondsToPlainDateUtc = (
  seconds: number,
): Temporal.PlainDate =>
  Temporal.Instant.fromEpochMilliseconds(seconds * 1000)
    .toZonedDateTimeISO('UTC')
    .toPlainDate()
