import { describe, expect, it } from 'vitest'
import { formatTimestamp, formatTimestampDate } from './formatTimestamp'

describe('formatTimestamp', () => {
  it('should format timestamp to YYYY/MM/DD HH:MM:SS format', () => {
    // 2021-01-01 00:00:00 UTC
    const timestamp = 1609459200n

    const result = formatTimestamp(timestamp)

    expect(result).toBe('2021/01/01 00:00:00')
  })

  it('should return null for undefined timestamp', () => {
    const result = formatTimestamp(undefined)

    expect(result).toBeNull()
  })
})

describe('formatTimestampDate', () => {
  it('should format a bigint timestamp to "Month DD, YYYY" in UTC', () => {
    // 2025-10-25 00:00:00 UTC
    const timestamp = 1761350400n

    const result = formatTimestampDate(timestamp)

    expect(result).toBe('October 25, 2025')
  })

  it('should accept a number timestamp', () => {
    // 2021-01-01 00:00:00 UTC
    const result = formatTimestampDate(1609459200)

    expect(result).toBe('January 1, 2021')
  })

  it('should use UTC even near a day boundary', () => {
    // 2025-10-25 23:59:59 UTC — must not roll to the 26th
    const result = formatTimestampDate(1761436799n)

    expect(result).toBe('October 25, 2025')
  })

  it('should return null for undefined timestamp', () => {
    const result = formatTimestampDate(undefined)

    expect(result).toBeNull()
  })
})
