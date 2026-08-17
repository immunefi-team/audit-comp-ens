import { describe, expect, it } from 'vitest'
import { getCoinByCoinType, getCoinByName, SUPPORTED_COINS } from './coins'

describe('coins', () => {
  describe('SUPPORTED_COINS', () => {
    it('contains ETH as the first coin (priority)', () => {
      expect(SUPPORTED_COINS[0].name).toBe('eth')
      expect(SUPPORTED_COINS[0].coinType).toBe(60)
    })

    it('contains BTC as the second coin (priority)', () => {
      expect(SUPPORTED_COINS[1].name).toBe('btc')
      expect(SUPPORTED_COINS[1].coinType).toBe(0)
    })

    it('has correct structure for each coin', () => {
      for (const coin of SUPPORTED_COINS) {
        expect(coin).toHaveProperty('name')
        expect(coin).toHaveProperty('longName')
        expect(coin).toHaveProperty('coinType')
        expect(coin).toHaveProperty('icon')

        expect(typeof coin.name).toBe('string')
        expect(typeof coin.longName).toBe('string')
        expect(typeof coin.coinType).toBe('number')
        expect(coin.icon === null || typeof coin.icon === 'string').toBe(true)
      }
    })

    it('has icons in the correct format', () => {
      const coinsWithIcons = SUPPORTED_COINS.filter(
        (coin) => coin.icon !== null,
      )
      expect(coinsWithIcons.length).toBeGreaterThan(0)

      for (const coin of coinsWithIcons) {
        expect(coin.icon).toMatch(/^\/address\/\w+Icon\.svg$/)
      }
    })

    it('contains major cryptocurrencies', () => {
      const coinNames = SUPPORTED_COINS.map((c) => c.name)
      expect(coinNames).toContain('eth')
      expect(coinNames).toContain('btc')
      expect(coinNames).toContain('sol')
      expect(coinNames).toContain('matic')
      expect(coinNames).toContain('op')
      expect(coinNames).toContain('arb1')
      expect(coinNames).toContain('base')
    })
  })

  describe('getCoinByName', () => {
    it('returns ETH coin for "eth"', () => {
      const coin = getCoinByName('eth')
      expect(coin).toBeDefined()
      expect(coin?.name).toBe('eth')
      expect(coin?.coinType).toBe(60)
      expect(coin?.longName).toBe('Ethereum')
    })

    it('returns ETH coin for "ETH" (case insensitive)', () => {
      const coin = getCoinByName('ETH')
      expect(coin).toBeDefined()
      expect(coin?.name).toBe('eth')
    })

    it('returns BTC coin for "btc"', () => {
      const coin = getCoinByName('btc')
      expect(coin).toBeDefined()
      expect(coin?.name).toBe('btc')
      expect(coin?.coinType).toBe(0)
      expect(coin?.longName).toBe('Bitcoin')
    })

    it('returns SOL coin for "sol"', () => {
      const coin = getCoinByName('sol')
      expect(coin).toBeDefined()
      expect(coin?.name).toBe('sol')
      expect(coin?.coinType).toBe(501)
    })

    it('returns undefined for unknown coin', () => {
      const coin = getCoinByName('unknown-coin-xyz')
      expect(coin).toBeUndefined()
    })
  })

  describe('getCoinByCoinType', () => {
    it('returns ETH coin for coinType 60', () => {
      const coin = getCoinByCoinType(60)
      expect(coin).toBeDefined()
      expect(coin?.name).toBe('eth')
      expect(coin?.coinType).toBe(60)
    })

    it('returns BTC coin for coinType 0', () => {
      const coin = getCoinByCoinType(0)
      expect(coin).toBeDefined()
      expect(coin?.name).toBe('btc')
      expect(coin?.coinType).toBe(0)
    })

    it('returns SOL coin for coinType 501', () => {
      const coin = getCoinByCoinType(501)
      expect(coin).toBeDefined()
      expect(coin?.name).toBe('sol')
    })

    it('returns undefined for unknown coinType', () => {
      const coin = getCoinByCoinType(999999999)
      expect(coin).toBeUndefined()
    })
  })
})
