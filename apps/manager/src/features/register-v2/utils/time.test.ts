import { describe, expect, it } from 'vitest'
import {
  getCalendarYearDurationYears,
  getCanonicalDurationYears,
  getDurationDisplayParts,
  getDurationExpiryDateForDisplay,
  getDurationInSecondsFromYears,
  SECONDS_IN_YEAR,
} from './time'

describe('register-v2 time utils', () => {
  describe('getDurationInSecondsFromYears', () => {
    it('returns the contract threshold when the calendar span is shorter', () => {
      const result = getDurationInSecondsFromYears(
        2,
        new Date('2025-01-15T12:00:00.000Z'),
      )

      expect(result).toBe(2 * SECONDS_IN_YEAR)
      expect(result).toBeGreaterThan(730 * 86_400)
    })

    it('returns the full calendar span when it is larger than the contract threshold', () => {
      const result = getDurationInSecondsFromYears(
        3,
        new Date('2026-01-01T18:30:00.000Z'),
      )

      expect(result).toBe(1096 * 86_400)
    })

    it('floors and clamps values below one year to one year', () => {
      expect(getDurationInSecondsFromYears(0.5, new Date('2025-01-15'))).toBe(
        SECONDS_IN_YEAR,
      )
    })
  })

  describe('preset display helpers', () => {
    it('formats canonical preset durations as whole years', () => {
      const referenceDate = new Date('2026-01-01T18:30:00.000Z')
      const duration = getDurationInSecondsFromYears(3, referenceDate)

      expect(getDurationDisplayParts(duration, referenceDate)).toEqual({
        years: 3,
        months: 0,
        weeks: 0,
        days: 0,
      })
    })

    it('does not treat a manual duration just below the threshold as a preset', () => {
      const referenceDate = new Date('2025-01-15T12:00:00.000Z')
      const duration = getDurationInSecondsFromYears(2, referenceDate) - 43_200

      expect(getCanonicalDurationYears(duration, referenceDate)).toBeNull()
    })

    it('still recognizes a manual selection on the same calendar anniversary as whole years for labels', () => {
      const referenceDate = new Date('2026-07-29T18:00:00.000Z')
      const manualDuration = 365 * 86_400

      expect(
        getCanonicalDurationYears(manualDuration, referenceDate),
      ).toBeNull()
      expect(getCalendarYearDurationYears(manualDuration, referenceDate)).toBe(
        1,
      )
      expect(getDurationDisplayParts(manualDuration, referenceDate)).toEqual({
        years: 1,
        months: 0,
        weeks: 0,
        days: 0,
      })
    })

    it('shows one extra calendar day when a user picks the day after a one-year anniversary', () => {
      const referenceDate = new Date('2026-07-29T18:00:00.000Z')
      const manualDuration = 366 * 86_400

      expect(getDurationDisplayParts(manualDuration, referenceDate)).toEqual({
        years: 1,
        months: 0,
        weeks: 0,
        days: 1,
      })
    })

    it('uses calendar-day math for short manual durations with a non-midnight reference', () => {
      const referenceDate = new Date('2029-10-31T18:00:00.000Z')
      const manualDuration = 30 * 86_400

      expect(getDurationDisplayParts(manualDuration, referenceDate)).toEqual({
        years: 0,
        months: 0,
        weeks: 4,
        days: 2,
      })
    })

    it('does not overcount years when a short duration crosses a calendar year boundary', () => {
      const referenceDate = new Date('2026-12-31T18:00:00.000Z')
      const manualDuration = 30 * 86_400

      expect(getDurationDisplayParts(manualDuration, referenceDate)).toEqual({
        years: 0,
        months: 0,
        weeks: 4,
        days: 2,
      })
    })

    it('keeps preset expiry display on the same calendar date', () => {
      const referenceDate = new Date('2025-01-15T21:00:00.000Z')
      const duration = getDurationInSecondsFromYears(2, referenceDate)
      const expiryDate = getDurationExpiryDateForDisplay(
        duration,
        referenceDate,
      )

      expect(expiryDate.getFullYear()).toBe(2027)
      expect(expiryDate.getMonth()).toBe(0)
      expect(expiryDate.getDate()).toBe(15)
    })
  })
})
