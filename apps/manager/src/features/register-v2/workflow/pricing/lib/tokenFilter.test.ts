import { describe, expect, it } from 'vitest'
import type { StablecoinBalance } from '@/lib/smart-account'
import { filterStablecoinBalances } from './tokenFilter'

const balances: StablecoinBalance[] = [
  {
    address: '0x1',
    symbol: 'USDC',
    decimals: 6,
    balance: '1000000',
    formattedBalance: '1',
  },
  {
    address: '0x2',
    symbol: 'USDT',
    decimals: 6,
    balance: '2000000',
    formattedBalance: '2',
  },
]

describe('filterStablecoinBalances', () => {
  it('returns empty array when balances are missing', () => {
    expect(filterStablecoinBalances(undefined, 'usdc')).toEqual([])
  })

  it('returns all balances when query is empty', () => {
    expect(filterStablecoinBalances(balances, '   ')).toEqual(balances)
  })

  it('filters by symbol', () => {
    expect(filterStablecoinBalances(balances, 'usdt')).toEqual([balances[1]])
  })

  it('matches chain keyword', () => {
    expect(filterStablecoinBalances(balances, 'sepolia')).toEqual(balances)
  })
})
