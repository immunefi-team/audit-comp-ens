import { describe, expect, it } from 'vitest'
import {
  determinePremium,
  getErrorMessage,
  getPremiumLabel,
  isNameAvailabilityError,
  NameAvailabilityError,
  normalizeQuery,
  validateENSName,
} from './nameUtils'

describe('register utils', () => {
  describe('normalizeQuery', () => {
    it('should add .eth suffix to plain name', () => {
      expect(normalizeQuery('example')).toBe('example.eth')
    })

    it('should not duplicate .eth suffix', () => {
      expect(normalizeQuery('example.eth')).toBe('example.eth')
    })

    it('should trim whitespace', () => {
      expect(normalizeQuery('  example  ')).toBe('example.eth')
    })

    it('should convert to lowercase', () => {
      expect(normalizeQuery('EXAMPLE')).toBe('example.eth')
    })

    it('should handle empty string', () => {
      expect(normalizeQuery('')).toBe('')
    })

    it('should handle whitespace only string', () => {
      expect(normalizeQuery('   ')).toBe('')
    })

    it('should handle uppercase .ETH suffix', () => {
      expect(normalizeQuery('example.ETH')).toBe('example.eth')
    })

    it('should handle mixed case', () => {
      expect(normalizeQuery('ExAmPlE.Eth')).toBe('example.eth')
    })
  })

  describe('determinePremium', () => {
    it('should return true for 1 character names', () => {
      expect(determinePremium('a')).toBe(true)
      expect(determinePremium('a.eth')).toBe(true)
    })

    it('should return true for 2 character names', () => {
      expect(determinePremium('ab')).toBe(true)
      expect(determinePremium('ab.eth')).toBe(true)
    })

    it('should return true for 3 character names', () => {
      expect(determinePremium('abc')).toBe(true)
      expect(determinePremium('abc.eth')).toBe(true)
    })

    it('should return true for 4 character names', () => {
      expect(determinePremium('abcd')).toBe(true)
      expect(determinePremium('abcd.eth')).toBe(true)
    })

    it('should return false for 5+ character names', () => {
      expect(determinePremium('abcde')).toBe(false)
      expect(determinePremium('abcde.eth')).toBe(false)
    })

    it('should handle whitespace', () => {
      expect(determinePremium('  abc  ')).toBe(true)
    })

    it('should handle uppercase', () => {
      expect(determinePremium('ABC')).toBe(true)
      expect(determinePremium('ABC.ETH')).toBe(true)
    })

    it('should return false for empty name', () => {
      expect(determinePremium('')).toBe(false)
      expect(determinePremium('.eth')).toBe(false)
    })

    it('should count emojis as single characters (code points)', () => {
      expect(determinePremium('🎲🎲🎲')).toBe(true) // 3 code points = premium
      expect(determinePremium('🎲🎲🎲🎲')).toBe(true) // 4 code points = premium
      expect(determinePremium('🎲🎲🎲🎲🎲')).toBe(false) // 5 code points = not premium
      expect(determinePremium('🎲🎲🎲.eth')).toBe(true)
    })
  })

  describe('getPremiumLabel', () => {
    it('should return premium-3 variant for 1-3 character names', () => {
      expect(getPremiumLabel('a')).toEqual({
        label: '1 character premium name',
        variant: 'premium-3',
      })
      expect(getPremiumLabel('ab')).toEqual({
        label: '2 character premium name',
        variant: 'premium-3',
      })
      expect(getPremiumLabel('abc')).toEqual({
        label: '3 character premium name',
        variant: 'premium-3',
      })
    })

    it('should return premium-4 variant for 4 character names', () => {
      expect(getPremiumLabel('abcd')).toEqual({
        label: '4 character premium name',
        variant: 'premium-4',
      })
    })

    it('should return undefined for non-premium names', () => {
      expect(getPremiumLabel('abcde')).toBeUndefined()
      expect(getPremiumLabel('abcdefgh')).toBeUndefined()
    })

    it('should handle .eth suffix', () => {
      expect(getPremiumLabel('abc.eth')).toEqual({
        label: '3 character premium name',
        variant: 'premium-3',
      })
    })

    it('should return undefined for empty name', () => {
      expect(getPremiumLabel('')).toBeUndefined()
    })

    it('should return undefined for only .eth', () => {
      expect(getPremiumLabel('.eth')).toBeUndefined()
    })

    it('should return undefined for names with multiple dots (subdomains)', () => {
      // Names with multiple dots like 'abc.sub.eth' have a label of 'abc.sub'
      // which is longer than 4 characters, so they are not premium
      expect(getPremiumLabel('abc.sub.eth')).toBeUndefined()
    })

    it('should count emojis as single characters (code points)', () => {
      expect(getPremiumLabel('🎲🎲🎲')).toEqual({
        label: '3 character premium name',
        variant: 'premium-3',
      })
      expect(getPremiumLabel('🎲🎲🎲🎲')).toEqual({
        label: '4 character premium name',
        variant: 'premium-4',
      })
      expect(getPremiumLabel('🎲🎲🎲🎲🎲')).toBeUndefined() // 5 code points = not premium
    })
  })

  describe('validateENSName', () => {
    it('should return null for valid 3+ character names', () => {
      expect(validateENSName('abc')).toBeNull()
      expect(validateENSName('example')).toBeNull()
      expect(validateENSName('my-name')).toBeNull()
    })

    it('should return null for valid names with .eth suffix', () => {
      expect(validateENSName('example.eth')).toBeNull()
      expect(validateENSName('abc.eth')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(validateENSName('')).toBeNull()
    })

    it('should return null for whitespace only', () => {
      expect(validateENSName('   ')).toBeNull()
    })

    it('should return TOO_SHORT error for 1-2 character names', () => {
      expect(validateENSName('a')).toEqual({
        type: 'TOO_SHORT',
        message: 'Names must be 3 characters or more to register.',
      })
      expect(validateENSName('ab')).toEqual({
        type: 'TOO_SHORT',
        message: 'Names must be 3 characters or more to register.',
      })
    })

    it('should return TOO_SHORT error for short names with .eth', () => {
      expect(validateENSName('a.eth')).toEqual({
        type: 'TOO_SHORT',
        message: 'Names must be 3 characters or more to register.',
      })
    })

    it('should return INVALID_FORMAT for names with spaces', () => {
      expect(validateENSName('hello world')).toEqual({
        type: 'INVALID_FORMAT',
        message:
          "Something in the name isn't supported. Try letters, numbers, hyphens, or emojis with no spaces.",
      })
    })

    it('should return INVALID_FORMAT for consecutive dots', () => {
      expect(validateENSName('test..eth')).toEqual({
        type: 'INVALID_FORMAT',
        message:
          "Something in the name isn't supported. Try letters, numbers, hyphens, or emojis with no spaces.",
      })
    })

    it('should return INVALID_FORMAT for extra dots in label', () => {
      expect(validateENSName('sub.domain.eth')).toEqual({
        type: 'INVALID_FORMAT',
        message:
          "Something in the name isn't supported. Try letters, numbers, hyphens, or emojis with no spaces.",
      })
    })

    it('should return INVALID_CHARACTER for special characters', () => {
      const specialChars = [
        '&',
        '*',
        '@',
        '#',
        '$',
        '%',
        '^',
        '!',
        '?',
        '=',
        '+',
      ]
      for (const char of specialChars) {
        const result = validateENSName(`test${char}name`)
        expect(result).toEqual({
          type: 'INVALID_CHARACTER',
          message:
            "That character isn't supported. Try letters, numbers, hyphens, or emojis.",
        })
      }
    })

    it('should return INVALID_CHARACTER for brackets and braces', () => {
      expect(validateENSName('test[name]')).toEqual({
        type: 'INVALID_CHARACTER',
        message:
          "That character isn't supported. Try letters, numbers, hyphens, or emojis.",
      })
      expect(validateENSName('test{name}')).toEqual({
        type: 'INVALID_CHARACTER',
        message:
          "That character isn't supported. Try letters, numbers, hyphens, or emojis.",
      })
      expect(validateENSName('test(name)')).toEqual({
        type: 'INVALID_CHARACTER',
        message:
          "That character isn't supported. Try letters, numbers, hyphens, or emojis.",
      })
    })

    it('should allow hyphens', () => {
      expect(validateENSName('my-name')).toBeNull()
      expect(validateENSName('my-long-name')).toBeNull()
      expect(validateENSName('-start')).toBeNull()
      expect(validateENSName('end-')).toBeNull()
    })

    it('should allow numbers', () => {
      expect(validateENSName('test123')).toBeNull()
      expect(validateENSName('123test')).toBeNull()
      expect(validateENSName('12345')).toBeNull()
    })

    it('should allow emojis', () => {
      expect(validateENSName('test🔥')).toBeNull()
      expect(validateENSName('🚀rocket')).toBeNull()
      expect(validateENSName('🎉🎊🎁')).toBeNull()
    })

    it('should trim whitespace before validation', () => {
      expect(validateENSName('  example  ')).toBeNull()
      expect(validateENSName('  ab  ')).toEqual({
        type: 'TOO_SHORT',
        message: 'Names must be 3 characters or more to register.',
      })
    })

    it('should count emojis as single characters (code points)', () => {
      expect(validateENSName('🎲🎲')).toEqual({
        type: 'TOO_SHORT',
        message: 'Names must be 3 characters or more to register.',
      })
      expect(validateENSName('🎲🎲🎲')).toBeNull() // 3 code points = valid
      expect(validateENSName('🎲🎲🎲🎲🎲')).toBeNull() // 5 code points = valid
    })
  })

  describe('isNameAvailabilityError', () => {
    it('should return true for NameAvailabilityError instances', () => {
      const error = new NameAvailabilityError({ cause: 'Not available' })
      expect(isNameAvailabilityError(error)).toBe(true)
    })

    it('should return false for regular Error', () => {
      const error = new Error('Regular error')
      expect(isNameAvailabilityError(error)).toBe(false)
    })

    it('should return false for string', () => {
      expect(isNameAvailabilityError('error string')).toBe(false)
    })

    it('should return false for null', () => {
      expect(isNameAvailabilityError(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isNameAvailabilityError(undefined)).toBe(false)
    })

    it('should return false for plain object', () => {
      expect(isNameAvailabilityError({ message: 'error' })).toBe(false)
    })
  })

  describe('getErrorMessage', () => {
    it('should return cause for NameAvailabilityError', () => {
      const error = new NameAvailabilityError({ cause: 'Name not available' })
      expect(getErrorMessage(error)).toBe('Name not available')
    })

    it('should return the error itself for other error types', () => {
      const error = new Error('Regular error')
      expect(getErrorMessage(error)).toBe(error)
    })

    it('should return string as-is', () => {
      expect(getErrorMessage('error string')).toBe('error string')
    })

    it('should return null as-is', () => {
      expect(getErrorMessage(null)).toBeNull()
    })

    it('should return undefined as-is', () => {
      expect(getErrorMessage(undefined)).toBeUndefined()
    })
  })
})
