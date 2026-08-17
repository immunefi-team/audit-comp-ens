import type { Chain } from 'viem'
import { describe, expect, it } from 'vitest'
import { getBlockExplorerAddressUrl } from './getBlockExplorerAddressUrl'

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
]

const ADDRESS = '0x1234567890123456789012345678901234567890'

describe('getBlockExplorerAddressUrl', () => {
  it('returns full address URL for known chain', () => {
    const result = getBlockExplorerAddressUrl(MOCK_CHAINS, 11155111, ADDRESS)

    expect(result).toBe(`https://sepolia.etherscan.io/address/${ADDRESS}`)
  })

  it('strips trailing slash from base URL', () => {
    const result = getBlockExplorerAddressUrl(MOCK_CHAINS, 1, ADDRESS)

    expect(result).toBe(`https://etherscan.io/address/${ADDRESS}`)
  })

  it('throws when chain has no block explorer', () => {
    const chainsWithNoExplorer: Chain[] = [
      { id: 999, name: 'Unknown', blockExplorers: undefined } as Chain,
    ]
    expect(() =>
      getBlockExplorerAddressUrl(chainsWithNoExplorer, 999, ADDRESS),
    ).toThrow('Chain 999 has no block explorer')
  })
})
