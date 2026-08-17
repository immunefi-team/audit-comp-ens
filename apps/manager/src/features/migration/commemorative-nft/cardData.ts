import type { Address } from 'viem'
import type { CommemorativeNftCardData } from '../components/success/MigrationSuccessDialog.types'
import {
  buildCommemorativeNftMarketplaceUrl,
  buildCommemorativeNftProfileUrl,
  buildCommemorativeNftShareUrls,
} from './sharing'
import type { CommemorativeNftEligibility } from './types'

export const buildCommemorativeNftCardData = (params: {
  readonly artworkUrl?: string
  readonly chainId: number
  readonly eligibility: CommemorativeNftEligibility
  readonly migratedAt: Date
  readonly migratedNameCount: number
  readonly minted: boolean
  readonly ownerAddress: Address
}): CommemorativeNftCardData => {
  const shareTarget =
    params.eligibility.assets.externalUrl ??
    buildCommemorativeNftProfileUrl(params.eligibility.profileName)

  return {
    artworkUrl: params.artworkUrl,
    assets: params.eligibility.assets,
    eligibility: params.eligibility,
    marketplaceUrl: buildCommemorativeNftMarketplaceUrl({
      chainId: params.chainId,
      ownerAddress: params.ownerAddress,
      minted: params.minted,
    }),
    migratedAt: params.migratedAt,
    migratedNameCount: params.migratedNameCount,
    shareUrls: buildCommemorativeNftShareUrls(shareTarget),
  }
}
