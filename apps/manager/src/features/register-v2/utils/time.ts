import type { Duration } from 'date-fns'
import {
  addYears,
  differenceInCalendarDays,
  differenceInCalendarYears,
  startOfDay,
} from 'date-fns'
import { secondsInDay } from 'date-fns/constants'

/**
 * Days in a year.
 * `date-fns` uses 365.2425 days in a year but the contracts use 365.25 days so we need to use this constant instead.
 */
export const DAYS_IN_YEAR = 365.25

export const SECONDS_IN_YEAR = DAYS_IN_YEAR * secondsInDay
export const MAX_DURATION_YEARS = 100

const clampDurationYears = (years: number) =>
  Math.min(Math.max(1, Math.floor(years)), MAX_DURATION_YEARS)

export const getStartOfDay = (referenceDate: Date = new Date()) =>
  startOfDay(referenceDate)

export const getDurationInSecondsFromYears = (
  years: number,
  referenceDate: Date = new Date(),
) => {
  const normalizedReferenceDate = getStartOfDay(referenceDate)
  const normalizedYears = clampDurationYears(years)
  const thresholdDuration = normalizedYears * SECONDS_IN_YEAR
  const calendarDuration =
    differenceInCalendarDays(
      addYears(normalizedReferenceDate, normalizedYears),
      normalizedReferenceDate,
    ) * secondsInDay

  return Math.max(thresholdDuration, calendarDuration)
}

export const getCanonicalDurationYears = (
  duration: number,
  referenceDate: Date = new Date(),
) => {
  const normalizedDuration = Math.round(duration)
  const candidateYears = clampDurationYears(duration / SECONDS_IN_YEAR)

  if (
    getDurationInSecondsFromYears(candidateYears, referenceDate) !==
    normalizedDuration
  ) {
    return null
  }

  return candidateYears
}

export const getCalendarYearDurationYears = (
  duration: number,
  referenceDate: Date = new Date(),
) => {
  const normalizedReferenceDate = getStartOfDay(referenceDate)
  const expiryDate = getDurationExpiryDateForDisplay(duration, referenceDate)
  const normalizedExpiryDate = getStartOfDay(expiryDate)
  const calendarYears = differenceInCalendarYears(
    normalizedExpiryDate,
    normalizedReferenceDate,
  )

  if (calendarYears < 1) {
    return null
  }

  const remainingDays = differenceInCalendarDays(
    normalizedExpiryDate,
    addYears(normalizedReferenceDate, calendarYears),
  )

  if (remainingDays !== 0) {
    return null
  }

  return calendarYears
}

export type DurationDisplayParts = {
  readonly years: number
  readonly months: number
  readonly weeks: number
  readonly days: number
}

export const getDurationDisplayParts = (
  duration: number,
  referenceDate: Date = new Date(),
) => {
  const normalizedReferenceDate = getStartOfDay(referenceDate)
  const normalizedExpiryDate = getStartOfDay(
    getDurationExpiryDateForDisplay(duration, referenceDate),
  )
  const rawYears = Math.max(
    0,
    differenceInCalendarYears(normalizedExpiryDate, normalizedReferenceDate),
  )
  const years =
    addYears(normalizedReferenceDate, rawYears).getTime() >
    normalizedExpiryDate.getTime()
      ? rawYears - 1
      : rawYears
  const remainingDays = differenceInCalendarDays(
    normalizedExpiryDate,
    addYears(normalizedReferenceDate, years),
  )
  const weeks = Math.floor(remainingDays / 7)
  const days = remainingDays % 7

  return {
    years,
    months: 0,
    weeks,
    days,
  } satisfies DurationDisplayParts
}

export const getDurationExpiryDateForDisplay = (
  duration: number,
  referenceDate: Date = new Date(),
) => {
  const canonicalYears = getCanonicalDurationYears(duration, referenceDate)

  if (canonicalYears) {
    return addYears(getStartOfDay(referenceDate), canonicalYears)
  }

  return new Date(referenceDate.getTime() + duration * 1000)
}

export const durationToSeconds = ({
  years,
  months,
  weeks,
  days,
  hours,
  minutes,
  seconds,
}: Duration) => {
  let totalDays = 0

  if (years) totalDays += years * DAYS_IN_YEAR
  if (months) totalDays += months * (DAYS_IN_YEAR / 12)
  if (weeks) totalDays += weeks * 7
  if (days) totalDays += days

  let totalSeconds = totalDays * 24 * 60 * 60

  if (hours) totalSeconds += hours * 60 * 60
  if (minutes) totalSeconds += minutes * 60
  if (seconds) totalSeconds += seconds

  return totalSeconds
}
