import type { Hex } from 'viem'
import type {
  CommemorativeNftAssets,
  CommemorativeNftEligibility,
  CommemorativeNftShareUrls,
} from '../../commemorative-nft/types'

export type CommemorativeNftCardData = {
  readonly artworkUrl?: string
  readonly assets: CommemorativeNftAssets
  readonly eligibility: CommemorativeNftEligibility
  readonly marketplaceUrl?: string
  readonly migratedAt: Date
  readonly migratedNameCount: number
  readonly shareUrls: CommemorativeNftShareUrls
}

export type MigrationSuccessDialogState =
  | { readonly status: 'loadingEligibility' }
  | { readonly status: 'ineligible' }
  | { readonly status: 'revealing'; readonly card: CommemorativeNftCardData }
  | { readonly status: 'readyToMint'; readonly card: CommemorativeNftCardData }
  | {
      readonly status: 'minting'
      readonly card: CommemorativeNftCardData
      readonly txHash?: Hex
    }
  | { readonly status: 'minted'; readonly card: CommemorativeNftCardData }
  | {
      readonly status: 'error'
      readonly stage: 'configuration' | 'eligibility' | 'claim'
      readonly message: string
      readonly card?: CommemorativeNftCardData
    }
