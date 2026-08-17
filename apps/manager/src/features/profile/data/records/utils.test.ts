import { describe, expect, it } from 'vitest'
import { getRecordDef, getRecordDisplayValue, getRecordHref } from './utils'

describe('profile record utils', () => {
  describe('social URL normalization', () => {
    it('uses a pasted LinkedIn profile URL as the profile handle', () => {
      const record = getRecordDef('com.linkedin')

      expect(
        getRecordDisplayValue(record, 'https://www.linkedin.com/in/ebeau/'),
      ).toBe('ebeau')
      expect(getRecordHref(record, 'https://www.linkedin.com/in/ebeau/')).toBe(
        'https://www.linkedin.com/in/ebeau',
      )
    })

    it('uses pasted X and Telegram profile URLs as handles', () => {
      const xRecord = getRecordDef('com.twitter')
      const telegramRecord = getRecordDef('org.telegram')

      expect(
        getRecordDisplayValue(xRecord, 'https://twitter.com/ensdomains'),
      ).toBe('ensdomains')
      expect(getRecordHref(xRecord, 'https://x.com/ensdomains')).toBe(
        'https://x.com/ensdomains',
      )
      expect(
        getRecordDisplayValue(telegramRecord, 'https://t.me/ensdomains'),
      ).toBe('ensdomains')
      expect(getRecordHref(telegramRecord, 'https://t.me/ensdomains')).toBe(
        'https://t.me/ensdomains',
      )
    })

    it('removes handle prefixes from social display values', () => {
      expect(
        getRecordDisplayValue(getRecordDef('com.twitter'), '@ensdomains'),
      ).toBe('ensdomains')
      expect(
        getRecordDisplayValue(getRecordDef('com.reddit'), 'u/ensdomains'),
      ).toBe('ensdomains')
    })

    it('social href construction never produces javascript:/data: even for malicious handle values', () => {
      const xRecord = getRecordDef('com.twitter')
      const href = getRecordHref(xRecord, 'javascript:alert(1)')
      expect(href).toBe('https://x.com/javascript%3Aalert(1)')
      expect(href?.startsWith('javascript:')).toBe(false)
    })
  })
})
