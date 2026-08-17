import { getCoinTypeForReverseRegistrarChainId } from '@ens-apps/l2-primary/v1'
import { describe, expect, it } from 'vitest'
import { isL1ReverseRegistrarChainId } from './reverseRegistrarChainId'

describe('isL1ReverseRegistrarChainId', () => {
  it('should return true for chain ID 1 (Ethereum Mainnet)', () => {
    const result = isL1ReverseRegistrarChainId(1)

    expect(result).toBe(true)
  })

  it('should return true for chain ID 60 (Ethereum as coin type)', () => {
    const result = isL1ReverseRegistrarChainId(60)

    expect(result).toBe(true)
  })

  it('should return false for L2 chain IDs', () => {
    expect(isL1ReverseRegistrarChainId(10)).toBe(false) // Optimism
    expect(isL1ReverseRegistrarChainId(42161)).toBe(false) // Arbitrum
    expect(isL1ReverseRegistrarChainId(8453)).toBe(false) // Base
    expect(isL1ReverseRegistrarChainId(59144)).toBe(false) // Linea
    expect(isL1ReverseRegistrarChainId(534352)).toBe(false) // Scroll
  })

  it('should return false for unknown chain IDs', () => {
    expect(isL1ReverseRegistrarChainId(999)).toBe(false)
    expect(isL1ReverseRegistrarChainId(5)).toBe(false) // Goerli
    expect(isL1ReverseRegistrarChainId(11155111)).toBe(false) // Sepolia
  })

  it('should return false for zero', () => {
    expect(isL1ReverseRegistrarChainId(0)).toBe(false)
  })

  it('should return false for negative numbers', () => {
    expect(isL1ReverseRegistrarChainId(-1)).toBe(false)
    expect(isL1ReverseRegistrarChainId(-60)).toBe(false)
  })
})

/**
 * Guards the environment-aware coin-type derivation used by the forward- and
 * reverse-resolution features. The Sepolia deployment keys L2 reverse
 * namespaces on TESTNET chain-id coin types (verified on-chain: the OP Sepolia
 * `L2ReverseRegistrar.coinType()` is `0x80000000 | 11155420`, and only
 * `<hex(testnet coinType)>.reverse` namespaces have resolvers in the Sepolia
 * registry) — deriving from mainnet chain ids makes every reverse check
 * silently fail.
 */
describe('getCoinTypeForReverseRegistrarChainId', () => {
  it('derives Sepolia L2 coin types from TESTNET chain ids', () => {
    // 0x80000000 | <testnet chain id>
    expect(getCoinTypeForReverseRegistrarChainId(10, 'sepolia')).toBe(
      0x80aa37dc, // OP Sepolia (11155420)
    )
    expect(getCoinTypeForReverseRegistrarChainId(42161, 'sepolia')).toBe(
      0x80066eee, // Arbitrum Sepolia (421614)
    )
    expect(getCoinTypeForReverseRegistrarChainId(8453, 'sepolia')).toBe(
      0x80014a34, // Base Sepolia (84532)
    )
    expect(getCoinTypeForReverseRegistrarChainId(59144, 'sepolia')).toBe(
      (0x80000000 | 59141) >>> 0, // Linea Sepolia
    )
    expect(getCoinTypeForReverseRegistrarChainId(534352, 'sepolia')).toBe(
      (0x80000000 | 534351) >>> 0, // Scroll Sepolia
    )
  })

  it('derives mainnet L2 coin types from mainnet chain ids', () => {
    expect(getCoinTypeForReverseRegistrarChainId(10, 'mainnet')).toBe(
      0x8000000a,
    )
    expect(getCoinTypeForReverseRegistrarChainId(8453, 'mainnet')).toBe(
      0x80002105,
    )
  })

  it('maps the L1 keys (1 / 60) to coin 60 in every environment', () => {
    // The deployed contracts treat L1 testnets as mainnet clones.
    expect(getCoinTypeForReverseRegistrarChainId(1, 'sepolia')).toBe(60)
    expect(getCoinTypeForReverseRegistrarChainId(60, 'sepolia')).toBe(60)
    expect(getCoinTypeForReverseRegistrarChainId(1, 'mainnet')).toBe(60)
    expect(getCoinTypeForReverseRegistrarChainId(60, 'mainnet')).toBe(60)
  })

  it('defaults to sepolia', () => {
    expect(getCoinTypeForReverseRegistrarChainId(10)).toBe(0x80aa37dc)
  })
})
