import { describe, expect, it } from 'vitest'
import {
  DAI_DECIMALS,
  SUPPORTED_TOKENS,
  USDC_DECIMALS,
} from '@/lib/constants/tokens'
import type { SupportedTokenAddresses } from '../types/tokens'
import { getTokenMetadataWithAddress } from './tokenLookup'

describe('getTokenMetadataWithAddress', () => {
  it('returns USDC info for USDC address', () => {
    const result = getTokenMetadataWithAddress(SUPPORTED_TOKENS.USDC)
    expect(result).toEqual({
      symbol: 'USDC',
      address: SUPPORTED_TOKENS.USDC,
      decimals: USDC_DECIMALS,
    })
  })

  it('returns DAI info for DAI address', () => {
    const result = getTokenMetadataWithAddress(SUPPORTED_TOKENS.DAI)
    expect(result).toEqual({
      symbol: 'DAI',
      address: SUPPORTED_TOKENS.DAI,
      decimals: DAI_DECIMALS,
    })
  })

  it('compares addresses case-insensitively', () => {
    expect(getTokenMetadataWithAddress(SUPPORTED_TOKENS.USDC).symbol).toBe(
      'USDC',
    )
    expect(getTokenMetadataWithAddress(SUPPORTED_TOKENS.DAI).symbol).toBe('DAI')
  })

  it('throws for unsupported token address', () => {
    const unknownToken =
      '0x0000000000000000000000000000000000000001' as SupportedTokenAddresses

    expect(() => getTokenMetadataWithAddress(unknownToken)).toThrow(
      `Unsupported token address: ${unknownToken}`,
    )
  })

  it('throws for zero address', () => {
    const zeroAddress =
      '0x0000000000000000000000000000000000000000' as SupportedTokenAddresses

    expect(() => getTokenMetadataWithAddress(zeroAddress)).toThrow(
      `Unsupported token address: ${zeroAddress}`,
    )
  })
})
