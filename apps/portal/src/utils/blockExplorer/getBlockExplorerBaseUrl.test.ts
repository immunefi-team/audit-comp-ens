import type { Chain } from 'viem'
import { describe, expect, it } from 'vitest'
import { getBlockExplorerBaseUrl } from './getBlockExplorerBaseUrl'

const MOCK_CHAINS: Chain[] = [
  {
    id: 11155111,
    name: 'Sepolia',
    blockExplorers: {
      default: { url: 'https://sepolia.etherscan.io' },
    },
  } as Chain,
  {
    id: 1,
    name: 'Mainnet',
    blockExplorers: {
      default: { url: 'https://etherscan.io/' },
    },
  } as Chain,
  {
    id: 999,
    name: 'Unknown',
    blockExplorers: undefined,
  } as Chain,
]

describe('getBlockExplorerBaseUrl', () => {
  it('returns base URL for known chain', () => {
    const result = getBlockExplorerBaseUrl(MOCK_CHAINS, 11155111)

    expect(result).toBe('https://sepolia.etherscan.io')
  })

  it('strips trailing slash from base URL', () => {
    const result = getBlockExplorerBaseUrl(MOCK_CHAINS, 1)

    expect(result).toBe('https://etherscan.io')
  })

  it('throws when chain has no block explorer', () => {
    expect(() => getBlockExplorerBaseUrl(MOCK_CHAINS, 999)).toThrow(
      'Chain 999 has no block explorer',
    )
  })

  it('throws when chain is not in list', () => {
    expect(() => getBlockExplorerBaseUrl(MOCK_CHAINS, 12345)).toThrow(
      'Chain 12345 has no block explorer',
    )
  })

  it('returns same output for same inputs (pure)', () => {
    const result1 = getBlockExplorerBaseUrl(MOCK_CHAINS, 11155111)
    const result2 = getBlockExplorerBaseUrl(MOCK_CHAINS, 11155111)

    expect(result1).toBe(result2)
  })
})
