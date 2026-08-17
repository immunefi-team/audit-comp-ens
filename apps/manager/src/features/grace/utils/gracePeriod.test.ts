import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GRACE_PERIOD_DAYS,
  getDaysSinceExpiry,
  getDisplayExpiryDate,
  getGraceEndDate,
  isInGracePeriod,
  isPastGracePeriod,
  isRenewableV2EthName,
  MS_PER_DAY,
  shouldShowProminentRenew,
  V2_GRACE_PERIOD_DAYS,
} from './gracePeriod'

const base = new Date('2024-06-01T12:00:00Z')

describe('getGraceEndDate', () => {
  it('adds 28 days for v2', () => {
    const end = getGraceEndDate(base, 'v2')
    expect(end.getTime()).toBe(
      base.getTime() + V2_GRACE_PERIOD_DAYS * MS_PER_DAY,
    )
  })

  it('adds 90 days for v1', () => {
    const end = getGraceEndDate(base, 'v1')
    expect(end.getTime()).toBe(base.getTime() + GRACE_PERIOD_DAYS * MS_PER_DAY)
  })
})

describe('isInGracePeriod', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false before expiry', () => {
    vi.setSystemTime(base.getTime() - MS_PER_DAY)
    expect(isInGracePeriod(base, 'v2')).toBe(false)
  })

  it('returns true on first day of v2 grace', () => {
    vi.setSystemTime(base.getTime() + MS_PER_DAY)
    expect(isInGracePeriod(base, 'v2')).toBe(true)
  })

  it('returns true on last day of v2 grace', () => {
    vi.setSystemTime(base.getTime() + V2_GRACE_PERIOD_DAYS * MS_PER_DAY - 1)
    expect(isInGracePeriod(base, 'v2')).toBe(true)
  })

  it('returns false after v2 grace ends', () => {
    vi.setSystemTime(base.getTime() + V2_GRACE_PERIOD_DAYS * MS_PER_DAY)
    expect(isInGracePeriod(base, 'v2')).toBe(false)
  })

  it('returns true on last day of v1 grace', () => {
    vi.setSystemTime(base.getTime() + GRACE_PERIOD_DAYS * MS_PER_DAY - 1)
    expect(isInGracePeriod(base, 'v1')).toBe(true)
  })
})

describe('isPastGracePeriod', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false during grace', () => {
    vi.setSystemTime(base.getTime() + MS_PER_DAY)
    expect(isPastGracePeriod(base, 'v2')).toBe(false)
  })

  it('returns true after grace', () => {
    vi.setSystemTime(base.getTime() + V2_GRACE_PERIOD_DAYS * MS_PER_DAY)
    expect(isPastGracePeriod(base, 'v2')).toBe(true)
  })

  // A v1 name judged as v2 is called past grace up to 62 days early, which sent
  // it to registration while the registrar still refused it (WEB-1255).
  it('keeps a v1 name in grace where a v2 name would be past it', () => {
    vi.setSystemTime(base.getTime() + 40 * MS_PER_DAY)
    expect(isPastGracePeriod(base, 'v2')).toBe(true)
    expect(isPastGracePeriod(base, 'v1')).toBe(false)
  })
})

describe('getDaysSinceExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(base.getTime() + 3 * MS_PER_DAY)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns days since expiry', () => {
    expect(getDaysSinceExpiry(base)).toBe(3)
  })
})

describe('shouldShowProminentRenew', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true when in grace', () => {
    vi.setSystemTime(base.getTime() + MS_PER_DAY)
    expect(shouldShowProminentRenew(base, 'v2')).toBe(true)
  })

  it('returns true within 30 days before expiry', () => {
    vi.setSystemTime(base.getTime() - 10 * MS_PER_DAY)
    expect(shouldShowProminentRenew(base, 'v2')).toBe(true)
  })

  it('returns false more than 30 days before expiry', () => {
    vi.setSystemTime(base.getTime() - 31 * MS_PER_DAY)
    expect(shouldShowProminentRenew(base, 'v2')).toBe(false)
  })
})

describe('isRenewableV2EthName', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts a v2 name before expiry', () => {
    vi.setSystemTime(base.getTime() - MS_PER_DAY)
    expect(isRenewableV2EthName('alice.eth', base)).toBe(true)
  })

  it('accepts a v2 name within grace', () => {
    vi.setSystemTime(base.getTime() + MS_PER_DAY)
    expect(isRenewableV2EthName('alice.eth', base)).toBe(true)
  })

  it('rejects a v2 name after grace ends', () => {
    vi.setSystemTime(base.getTime() + V2_GRACE_PERIOD_DAYS * MS_PER_DAY)
    expect(isRenewableV2EthName('alice.eth', base)).toBe(false)
  })

  it('rejects when expiry is unknown', () => {
    expect(isRenewableV2EthName('alice.eth', null)).toBe(false)
  })

  it('rejects subnames', () => {
    expect(isRenewableV2EthName('sub.alice.eth', base)).toBe(false)
  })
})

describe('getDisplayExpiryDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns grace end when in grace', () => {
    vi.setSystemTime(base.getTime() + MS_PER_DAY)
    const display = getDisplayExpiryDate(base, 'v2')
    expect(display?.getTime()).toBe(getGraceEndDate(base, 'v2').getTime())
  })

  it('returns raw expiry when not in grace', () => {
    vi.setSystemTime(base.getTime() - MS_PER_DAY)
    expect(getDisplayExpiryDate(base, 'v2')?.getTime()).toBe(base.getTime())
  })
})
