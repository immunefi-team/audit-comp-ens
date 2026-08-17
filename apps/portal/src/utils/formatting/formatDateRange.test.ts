import { describe, expect, it } from 'vitest'
import { formatDate, getDateRangeLabel } from './formatDateRange'

describe('formatDateRange', () => {
  describe('formatDate', () => {
    it('should format date to locale string with slashes', () => {
      const date = new Date('2021-01-15T00:00:00Z')

      const result = formatDate(date)

      expect(result).toBeDefined()
      expect(result).toContain('/')
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    })

    it('should return undefined for undefined input', () => {
      const result = formatDate(undefined)

      expect(result).toBeUndefined()
    })
  })

  describe('getDateRangeLabel', () => {
    it('should return "All" when no dates are provided', () => {
      const result = getDateRangeLabel({})

      expect(result).toBe('All')
    })

    it('should return "From DATE" when only from date is provided', () => {
      const from = new Date('2021-01-15T00:00:00Z')

      const result = getDateRangeLabel({ from })

      expect(result).toMatch(/^From \d{2}\/\d{2}\/\d{4}$/)
    })

    it('should return "Until DATE" when only to date is provided', () => {
      const to = new Date('2021-12-31T00:00:00Z')

      const result = getDateRangeLabel({ to })

      expect(result).toMatch(/^Until \d{2}\/\d{2}\/\d{4}$/)
    })

    it('should return date range with hyphen when both dates are provided', () => {
      const from = new Date('2021-01-01T00:00:00Z')
      const to = new Date('2021-12-31T00:00:00Z')

      const result = getDateRangeLabel({ from, to })

      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4} - \d{2}\/\d{2}\/\d{4}/)
    })
  })
})
