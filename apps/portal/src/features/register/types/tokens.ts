import type { SUPPORTED_TOKENS } from '@/lib/constants/tokens'

export type SupportedTokenAddresses =
  (typeof SUPPORTED_TOKENS)[keyof typeof SUPPORTED_TOKENS]
