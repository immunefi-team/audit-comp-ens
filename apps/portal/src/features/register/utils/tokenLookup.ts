import { match } from 'ts-pattern'
import type { Address } from 'viem'
import {
  DAI_DECIMALS,
  SUPPORTED_TOKENS,
  SUPPORTED_TOKENS_SYMBOLS,
  type SupportedTokenSymbol,
  USDC_DECIMALS,
} from '@/lib/constants/tokens'

export type TokenInfo = {
  readonly symbol: SupportedTokenSymbol
  readonly address: Address
  readonly decimals: number
}

/**
 * Returns token metadata (symbol, address, decimals) for a supported registration payment token.
 * @throws Error if the token address is not USDC or DAI
 */
export function getTokenMetadataWithAddress(address: Address): TokenInfo {
  const normalized = address.toLowerCase()

  return match(normalized)
    .with(SUPPORTED_TOKENS.USDC.toLowerCase(), () => ({
      symbol: SUPPORTED_TOKENS_SYMBOLS.USDC,
      address: SUPPORTED_TOKENS.USDC,
      decimals: USDC_DECIMALS,
    }))
    .with(SUPPORTED_TOKENS.DAI.toLowerCase(), () => ({
      symbol: SUPPORTED_TOKENS_SYMBOLS.DAI,
      address: SUPPORTED_TOKENS.DAI,
      decimals: DAI_DECIMALS,
    }))
    .otherwise(() => {
      throw new Error(`Unsupported token address: ${address}`)
    })
}
