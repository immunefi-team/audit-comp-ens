import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MS_PER_DAY,
  V2_GRACE_PERIOD_DAYS,
} from '@/features/grace/utils/gracePeriod'
import { canRenewV2Name } from './renewableName'

const base = new Date('2024-06-01T12:00:00Z')

describe('canRenewV2Name', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows renew during grace', () => {
    vi.setSystemTime(base.getTime() + MS_PER_DAY)
    expect(canRenewV2Name('alice.eth', base)).toBe(true)
  })

  it('allows mixed-case names during grace', () => {
    vi.setSystemTime(base.getTime() + MS_PER_DAY)
    expect(canRenewV2Name('Alice.eth', base)).toBe(true)
    expect(canRenewV2Name('Alice.ETH', base)).toBe(true)
  })

  it('blocks renew after grace', () => {
    vi.setSystemTime(base.getTime() + V2_GRACE_PERIOD_DAYS * MS_PER_DAY)
    expect(canRenewV2Name('alice.eth', base)).toBe(false)
  })
})
