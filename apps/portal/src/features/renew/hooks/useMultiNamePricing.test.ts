import { describe, expect, it } from 'vitest'
import { CONTRACT_SECONDS_PER_YEAR } from '@/lib/constants/duration'
import {
  getLatestRenewalExpiry,
  getRenewalDurationSeconds,
} from './useMultiNamePricing'

const plainDate = (value: string) => Temporal.PlainDate.from(value)

describe('useMultiNamePricing pure helpers', () => {
  describe('getLatestRenewalExpiry', () => {
    it('returns the latest expiry date across selected names', () => {
      const latest = new Date('2027-06-15T00:00:00.000Z')
      const result = getLatestRenewalExpiry([
        {
          name: 'alpha.eth',
          isV2: false,
          expiryDate: new Date('2026-01-01T00:00:00.000Z'),
        },
        { name: 'beta.eth', isV2: true, expiryDate: latest },
        {
          name: 'gamma.eth',
          isV2: false,
          expiryDate: new Date('2027-03-10T00:00:00.000Z'),
        },
      ])

      expect(result).toEqual(latest)
    })

    it('ignores names without an expiry date', () => {
      const latest = new Date('2026-08-20T00:00:00.000Z')
      const result = getLatestRenewalExpiry([
        { name: 'alpha.eth', isV2: false, expiryDate: null },
        { name: 'beta.eth', isV2: true },
        { name: 'gamma.eth', isV2: false, expiryDate: latest },
      ])

      expect(result).toEqual(latest)
    })

    it('returns null when no names have an expiry date', () => {
      const result = getLatestRenewalExpiry([
        { name: 'alpha.eth', isV2: false, expiryDate: null },
        { name: 'beta.eth', isV2: true },
      ])

      expect(result).toBeNull()
    })
  })

  describe('getRenewalDurationSeconds', () => {
    it('converts years mode using CONTRACT_SECONDS_PER_YEAR', () => {
      const result = getRenewalDurationSeconds({
        spanType: 'years',
        duration: 2,
        baseDate: plainDate('2026-01-01'),
      })

      expect(result).toBe(2 * CONTRACT_SECONDS_PER_YEAR)
    })

    it('converts date mode using the provided target timestamp and base date', () => {
      const result = getRenewalDurationSeconds({
        spanType: 'date',
        duration: new Date('2026-03-01T00:00:00.000Z').getTime(),
        baseDate: plainDate('2026-01-01'),
      })

      // Jan 1 → Mar 1 2026 = 59 calendar days × 86400s (no +86399 offset —
      // calendar-day arithmetic is exact, see getDurationFromPickerDate).
      expect(result).toBe(59 * 86400)
    })

    it('throws for invalid date mode duration', () => {
      expect(() =>
        getRenewalDurationSeconds({
          spanType: 'date',
          duration: Number.NaN,
          baseDate: plainDate('2026-01-01'),
          dateModeReferenceDate: plainDate('2026-06-15'),
        }),
      ).toThrow('Date mode duration must be a valid timestamp')
    })
  })
})
