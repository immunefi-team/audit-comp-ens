import { describe, expect, it } from 'vitest'
import { USDCIcon } from '@/assets/usdc-icon'
import {
  DAI_DECIMALS,
  SUPPORTED_TOKENS,
  USDC_DECIMALS,
} from '@/lib/constants/tokens'
import type { SupportedTokenAddresses } from '../types/tokens'
import { buildTokenData, DEFAULT_PRICE } from './tokenData'

const mockToken = (
  symbol: string,
  address: SupportedTokenAddresses,
  decimals: number,
) => ({
  symbol,
  address,
  decimals,
  Icon: USDCIcon,
})

const validPrice = {
  total: 5_000_000n,
  base: 5_000_000n,
  premium: 0n,
  decimals: USDC_DECIMALS,
  hasPremium: false,
}

describe('buildTokenData', () => {
  it('returns token data with valid prices and balances', () => {
    const tokens = [
      mockToken('USDC', SUPPORTED_TOKENS.USDC, USDC_DECIMALS),
      mockToken('DAI', SUPPORTED_TOKENS.DAI, DAI_DECIMALS),
    ]

    const prices = [validPrice, { ...validPrice, total: 10_000_000n }]
    const balances = [100_000_000n, 50_000_000_000_000_000_000n]

    const result = buildTokenData(tokens, prices, balances, [])

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      ...tokens[0],
      price: validPrice,
      balance: 100_000_000n,
    })
    expect(result[1]).toMatchObject({
      ...tokens[1],
      price: prices[1],
      balance: 50_000_000_000_000_000_000n,
    })
  })

  it('uses DEFAULT_PRICE when price is undefined', () => {
    const tokens = [mockToken('USDC', SUPPORTED_TOKENS.USDC, USDC_DECIMALS)]
    const balances = [100n]

    const result = buildTokenData(tokens, [], balances, [])

    expect(result[0].price).toEqual(DEFAULT_PRICE)
    expect(result[0].balance).toBe(100n)
  })

  it('uses 0n when balance is undefined', () => {
    const tokens = [mockToken('USDC', SUPPORTED_TOKENS.USDC, USDC_DECIMALS)]
    const prices = [validPrice]
    const balances = [] as bigint[]

    const result = buildTokenData(tokens, prices, balances, [])

    expect(result[0].price).toEqual(validPrice)
    expect(result[0].balance).toBe(0n)
  })

  it('uses DEFAULT_PRICE when price fails isPriceResult check', () => {
    const tokens = [mockToken('USDC', SUPPORTED_TOKENS.USDC, USDC_DECIMALS)]
    const prices = [{ foo: 'bar' } as unknown as typeof validPrice]
    const balances = [100n]

    const result = buildTokenData(tokens, prices, balances, [])

    expect(result[0].price).toEqual(DEFAULT_PRICE)
  })

  it('handles empty tokens array', () => {
    const result = buildTokenData([], [], [], [])

    expect(result).toEqual([])
  })

  it('handles mismatched array lengths by using undefined for missing indices', () => {
    const tokens = [mockToken('USDC', SUPPORTED_TOKENS.USDC, USDC_DECIMALS)]
    const prices = [validPrice]
    const balances = [] as bigint[]

    const result = buildTokenData(tokens, prices, balances, [])

    expect(result[0].balance).toBe(0n)
  })
})
