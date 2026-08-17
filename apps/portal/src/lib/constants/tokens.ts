import { TOKENS } from '@ens-apps/transaction-manager/contracts/ens-sepolia'

export const USDC_DECIMALS = TOKENS.USDC.decimals
export const DAI_DECIMALS = TOKENS.DAI.decimals

export const SUPPORTED_TOKENS_SYMBOLS = {
  USDC: 'USDC',
  DAI: 'DAI',
} as const

export type SupportedTokenSymbol =
  (typeof SUPPORTED_TOKENS_SYMBOLS)[keyof typeof SUPPORTED_TOKENS_SYMBOLS]

export const SUPPORTED_TOKENS = {
  [SUPPORTED_TOKENS_SYMBOLS.USDC]: TOKENS.USDC.address,
  [SUPPORTED_TOKENS_SYMBOLS.DAI]: TOKENS.DAI.address,
} as const
