import { describe, expect, it } from 'vitest'
import { dateToPlainDate } from '@/utils/temporal'
import {
  getExtensionBaseDate,
  getExtensionDisplayedYears,
  getExtensionDurationForToggledSpan,
  getExtensionTargetDate,
} from './extensionDurationPicker'

describe('extensionDurationPicker helpers', () => {
  it('returns expiry date as the base date when provided', () => {
    expect(
      getExtensionBaseDate(new Date('2026-05-10T00:00:00.000Z')).toString(),
    ).toBe('2026-05-10')
  })

  it('derives target date from years mode', () => {
    const result = getExtensionTargetDate({
      baseDate: Temporal.PlainDate.from('2026-01-01'),
      duration: 2,
      spanType: 'years',
    })

    expect(result.toString()).toBe('2028-01-01')
  })

  it('derives target date from date mode timestamp', () => {
    const result = getExtensionTargetDate({
      baseDate: Temporal.PlainDate.from('2026-01-01'),
      duration: new Date('2026-04-15T00:00:00.000Z').getTime(),
      spanType: 'date',
    })

    expect(result.toString()).toBe('2026-04-15')
  })

  it('throws for invalid date mode duration', () => {
    expect(() =>
      getExtensionTargetDate({
        baseDate: Temporal.PlainDate.from('2026-01-01'),
        duration: Number.NaN,
        spanType: 'date',
      }),
    ).toThrow('Date mode duration must be a valid timestamp')
  })

  it('derives displayed years from date mode target date', () => {
    const result = getExtensionDisplayedYears({
      baseDate: Temporal.PlainDate.from('2026-01-01'),
      duration: new Date('2028-01-01T00:00:00.000Z').getTime(),
      spanType: 'date',
      targetDate: Temporal.PlainDate.from('2028-01-01'),
    })

    expect(result).toBe(2)
  })

  it('converts years mode toggle value to a date timestamp', () => {
    const result = getExtensionDurationForToggledSpan({
      baseDate: Temporal.PlainDate.from('2026-01-01'),
      displayedYears: 3,
      spanType: 'years',
    })

    expect(dateToPlainDate(new Date(result)).toString()).toBe('2029-01-01')
  })

  it('converts date mode toggle value back to displayed years', () => {
    const result = getExtensionDurationForToggledSpan({
      baseDate: Temporal.PlainDate.from('2026-01-01'),
      displayedYears: 3,
      spanType: 'date',
    })

    expect(result).toBe(3)
  })
})
