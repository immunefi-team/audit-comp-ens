import { differenceInCalendarDays, startOfDay } from 'date-fns'
import { secondsInDay } from 'date-fns/constants'
import { describe, expect, it } from 'vitest'
import { getDurationInSecondsFromYears } from '@/features/register-v2/utils/time'
import { MIN_REGISTER_DURATION_SECONDS } from '@/features/shared/registration/pricing'
import type { Selection } from '../types'
import {
  durationForName,
  durationSecondsForName,
  formatUsdAmount,
  newExpiryDateForName,
} from './pricing'

const preset = (years: number): Selection => ({ kind: 'preset', years })
const custom = (targetMs: number): Selection => ({ kind: 'custom', targetMs })
const expiryOf = (date: Date): bigint =>
  BigInt(Math.floor(date.getTime() / 1000))

describe('formatUsdAmount', () => {
  it('formats with two decimals and thousands separators', () => {
    expect(formatUsdAmount(1320)).toBe('$1,320.00')
    expect(formatUsdAmount(0)).toBe('$0.00')
    expect(formatUsdAmount(1234.5)).toBe('$1,234.50')
  })

  it('returns an em dash for non-finite values', () => {
    expect(formatUsdAmount(Number.NaN)).toBe('—')
    expect(formatUsdAmount(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('durationForName', () => {
  it('mirrors the single-name flow for presets (calendar-aligned years from the name expiry)', () => {
    const expiryDate = new Date(2026, 4, 10)
    const expiry = expiryOf(expiryDate)
    expect(durationForName(preset(1), expiry)).toBe(
      BigInt(getDurationInSecondsFromYears(1, expiryDate)),
    )
    expect(durationForName(preset(3), expiry)).toBe(
      BigInt(getDurationInSecondsFromYears(3, expiryDate)),
    )
  })

  it('renew-to-date is the whole-calendar-day span from the name expiry', () => {
    const expiryDate = new Date(2027, 0, 1)
    const target = new Date(2027, 1, 1) // 31 calendar days later
    const expected =
      differenceInCalendarDays(startOfDay(target), startOfDay(expiryDate)) *
      secondsInDay
    expect(
      durationForName(custom(target.getTime()), expiryOf(expiryDate)),
    ).toBe(BigInt(expected))
  })

  it('floors renew-to-date at the minimum renewal duration', () => {
    const expiryDate = new Date(2027, 0, 1)
    const target = new Date(2027, 0, 15) // 14 days — below the 28-day minimum
    expect(
      durationSecondsForName(custom(target.getTime()), expiryOf(expiryDate)),
    ).toBe(MIN_REGISTER_DURATION_SECONDS)
  })
})

describe('newExpiryDateForName', () => {
  it('presets land on the calendar-aligned year expiry', () => {
    const expiryDate = new Date(2026, 4, 10, 8, 30)
    const end = newExpiryDateForName(preset(1), expiryOf(expiryDate))
    expect(end.getFullYear()).toBe(2027)
    expect(end.getMonth()).toBe(4)
    expect(end.getDate()).toBe(10)
    expect(end.getHours()).toBe(0)
  })

  it('renew-to-date lands on the picked calendar day (local), matching the dialog', () => {
    const expiryDate = new Date(2027, 0, 1)
    const target = new Date(2027, 1, 1)
    const end = newExpiryDateForName(
      custom(target.getTime()),
      expiryOf(expiryDate),
    )
    expect(end.getFullYear()).toBe(2027)
    expect(end.getMonth()).toBe(1)
    expect(end.getDate()).toBe(1)
  })
})
