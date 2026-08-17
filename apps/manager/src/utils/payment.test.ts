import { describe, expect, it } from 'vitest'
import {
  checkSelectedCoinBalance,
  formatAmount,
  hasInsufficientBalance,
  parseBalance,
} from './payment'

describe('payment utils', () => {
  describe('formatAmount', () => {
    it('should format number with no decimals by default', () => {
      expect(formatAmount(1234)).toBe('1,234')
    })

    it('should format number with 2 decimals when specified', () => {
      expect(formatAmount(1234.56, 2)).toBe('1,234.56')
    })

    it('should add decimal places to whole numbers', () => {
      expect(formatAmount(1234, 2)).toBe('1,234.00')
    })

    it('should handle zero', () => {
      expect(formatAmount(0)).toBe('0')
      expect(formatAmount(0, 2)).toBe('0.00')
    })

    it('should handle large numbers', () => {
      expect(formatAmount(1234567890)).toBe('1,234,567,890')
      expect(formatAmount(1234567890.12, 2)).toBe('1,234,567,890.12')
    })

    it('should handle small numbers', () => {
      expect(formatAmount(0.12, 2)).toBe('0.12')
      expect(formatAmount(0.01, 2)).toBe('0.01')
    })

    it('should round to specified decimal places', () => {
      expect(formatAmount(1234.567, 2)).toBe('1,234.57')
      expect(formatAmount(1234.562, 2)).toBe('1,234.56')
    })

    it('should handle negative numbers', () => {
      expect(formatAmount(-1234)).toBe('-1,234')
      expect(formatAmount(-1234.56, 2)).toBe('-1,234.56')
    })
  })

  describe('parseBalance', () => {
    it('should return 0 for undefined', () => {
      expect(parseBalance(undefined)).toBe(0)
    })

    it('should return 0 for empty string', () => {
      expect(parseBalance('')).toBe(0)
    })

    it('should parse plain number string', () => {
      expect(parseBalance('1234')).toBe(1234)
    })

    it('should parse number with commas', () => {
      expect(parseBalance('1,234.56')).toBe(1234.56)
    })

    it('should parse number with dollar sign', () => {
      expect(parseBalance('$1,234.56')).toBe(1234.56)
    })

    it('should remove USDC token', () => {
      expect(parseBalance('1,234.56 USDC')).toBe(1234.56)
    })

    it('should remove DAI token', () => {
      expect(parseBalance('1,234.56 DAI')).toBe(1234.56)
    })

    it('should remove USDT token', () => {
      expect(parseBalance('1,234.56 USDT')).toBe(1234.56)
    })

    it('should remove ETH token', () => {
      expect(parseBalance('1,234.56 ETH')).toBe(1234.56)
    })

    it('should handle case-insensitive tokens', () => {
      expect(parseBalance('1,234.56 usdc')).toBe(1234.56)
      expect(parseBalance('1,234.56 Eth')).toBe(1234.56)
    })

    it('should handle multiple spaces', () => {
      expect(parseBalance('  1,234.56   USDC  ')).toBe(1234.56)
    })

    it('should handle decimal numbers', () => {
      expect(parseBalance('0.123456')).toBe(0.123456)
    })

    it('should return 0 for invalid numbers', () => {
      expect(parseBalance('abc')).toBe(0)
      expect(parseBalance('not a number')).toBe(0)
    })

    it('should handle negative numbers', () => {
      expect(parseBalance('-1,234.56')).toBe(-1234.56)
    })

    it('should handle zero', () => {
      expect(parseBalance('0')).toBe(0)
      expect(parseBalance('0.00')).toBe(0)
    })
  })

  describe('hasInsufficientBalance', () => {
    it('should return false when price is 0', () => {
      expect(hasInsufficientBalance(100, 0)).toBe(false)
    })

    it('should return false when price is negative', () => {
      expect(hasInsufficientBalance(100, -10)).toBe(false)
    })

    it('should return true when balance is less than price', () => {
      expect(hasInsufficientBalance(50, 100)).toBe(true)
    })

    it('should return false when balance is greater than price', () => {
      expect(hasInsufficientBalance(150, 100)).toBe(false)
    })

    it('should return false when balance equals price', () => {
      expect(hasInsufficientBalance(100, 100)).toBe(false)
    })

    it('should handle string balance', () => {
      expect(hasInsufficientBalance('$50.00 USDC', 100)).toBe(true)
      expect(hasInsufficientBalance('$150.00 USDC', 100)).toBe(false)
    })

    it('should handle undefined balance as 0', () => {
      expect(hasInsufficientBalance(undefined, 100)).toBe(true)
    })

    it('should parse balance string correctly', () => {
      expect(hasInsufficientBalance('1,234.56 USDC', 1000)).toBe(false)
      expect(hasInsufficientBalance('1,234.56 USDC', 2000)).toBe(true)
    })

    it('should handle edge cases', () => {
      expect(hasInsufficientBalance(0, 100)).toBe(true)
      expect(hasInsufficientBalance(0.01, 100)).toBe(true)
      expect(hasInsufficientBalance(99.99, 100)).toBe(true)
    })
  })

  describe('checkSelectedCoinBalance', () => {
    it('should return 0 balance and not insufficient for null coin', () => {
      const result = checkSelectedCoinBalance(null, 100)
      expect(result.balanceUSD).toBe(0)
      expect(result.isInsufficient).toBe(false)
    })

    it('should return 0 balance and not insufficient for undefined coin', () => {
      const result = checkSelectedCoinBalance(undefined, 100)
      expect(result.balanceUSD).toBe(0)
      expect(result.isInsufficient).toBe(false)
    })

    it('should parse balance and detect insufficiency', () => {
      const result = checkSelectedCoinBalance(
        { formattedBalance: '50.00 USDC' },
        100,
      )
      expect(result.balanceUSD).toBe(50)
      expect(result.isInsufficient).toBe(true)
    })

    it('should parse balance and detect sufficiency', () => {
      const result = checkSelectedCoinBalance(
        { formattedBalance: '150.00 USDC' },
        100,
      )
      expect(result.balanceUSD).toBe(150)
      expect(result.isInsufficient).toBe(false)
    })

    it('should handle exact balance match', () => {
      const result = checkSelectedCoinBalance(
        { formattedBalance: '100.00 USDC' },
        100,
      )
      expect(result.balanceUSD).toBe(100)
      expect(result.isInsufficient).toBe(false)
    })

    it('should handle price of 0', () => {
      const result = checkSelectedCoinBalance(
        { formattedBalance: '50.00 USDC' },
        0,
      )
      expect(result.balanceUSD).toBe(50)
      expect(result.isInsufficient).toBe(false)
    })

    it('should parse complex balance strings', () => {
      const result = checkSelectedCoinBalance(
        { formattedBalance: '$1,234.56 USDC' },
        1000,
      )
      expect(result.balanceUSD).toBe(1234.56)
      expect(result.isInsufficient).toBe(false)
    })

    it('should handle zero balance', () => {
      const result = checkSelectedCoinBalance(
        { formattedBalance: '0 USDC' },
        100,
      )
      expect(result.balanceUSD).toBe(0)
      expect(result.isInsufficient).toBe(true)
    })

    it('should handle invalid balance string', () => {
      const result = checkSelectedCoinBalance(
        { formattedBalance: 'invalid' },
        100,
      )
      expect(result.balanceUSD).toBe(0)
      expect(result.isInsufficient).toBe(true)
    })

    it('should handle different tokens', () => {
      expect(
        checkSelectedCoinBalance({ formattedBalance: '150 DAI' }, 100)
          .isInsufficient,
      ).toBe(false)
      expect(
        checkSelectedCoinBalance({ formattedBalance: '150 ETH' }, 100)
          .isInsufficient,
      ).toBe(false)
      expect(
        checkSelectedCoinBalance({ formattedBalance: '150 USDT' }, 100)
          .isInsufficient,
      ).toBe(false)
    })
  })
})
