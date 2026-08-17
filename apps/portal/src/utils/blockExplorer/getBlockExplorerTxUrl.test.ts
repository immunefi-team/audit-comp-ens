import type { Chain } from 'viem'
import { describe, expect, it } from 'vitest'
import { getBlockExplorerTxUrl } from './getBlockExplorerTxUrl'

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

const TX_HASH =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

describe('getBlockExplorerTxUrl', () => {
  it('returns full transaction URL for known chain', () => {
    const result = getBlockExplorerTxUrl(MOCK_CHAINS, 11155111, TX_HASH)

    expect(result).toBe(`https://sepolia.etherscan.io/tx/${TX_HASH}`)
  })

  it('handles base URL with trailing slash', () => {
    const result = getBlockExplorerTxUrl(MOCK_CHAINS, 1, TX_HASH)

    expect(result).toBe(`https://etherscan.io/tx/${TX_HASH}`)
  })

  it('throws when chain has no block explorer', () => {
    expect(() => getBlockExplorerTxUrl(MOCK_CHAINS, 999, TX_HASH)).toThrow(
      'Chain 999 has no block explorer',
    )
  })

  it('throws when chain is not in list', () => {
    expect(() => getBlockExplorerTxUrl(MOCK_CHAINS, 12345, TX_HASH)).toThrow(
      'Chain 12345 has no block explorer',
    )
  })

  it('returns same output for same inputs (pure)', () => {
    const result1 = getBlockExplorerTxUrl(MOCK_CHAINS, 11155111, TX_HASH)
    const result2 = getBlockExplorerTxUrl(MOCK_CHAINS, 11155111, TX_HASH)

    expect(result1).toBe(result2)
  })

  it('appends tx hash to base URL', () => {
    const shortHash = '0x123'
    const result = getBlockExplorerTxUrl(MOCK_CHAINS, 11155111, shortHash)

    expect(result).toBe('https://sepolia.etherscan.io/tx/0x123')
  })
})
