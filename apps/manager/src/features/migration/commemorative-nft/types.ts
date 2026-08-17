import type { Address, Hex } from 'viem'

export const COMMEMORATIVE_NFT_TRAIT_VALUES = {
  Era: ['Founding', 'Pioneer', 'DeFi', 'NFT', 'Merge', 'Surge'],
  Depth: ['Singular', 'Namer', 'Collector', 'Domainer'],
  Gasveteran: ['Battle-Scarred', 'Weathered', 'Seasoned', 'Fresh'],
  Archetype: ['Personal', 'Common', 'Numeric', 'Brand', 'Abstract', 'Symbolic'],
  Rarity: ['Elemental', 'Rare', 'Uncommon', 'Common'],
} as const

export type RendererTraits = {
  readonly Era: (typeof COMMEMORATIVE_NFT_TRAIT_VALUES.Era)[number]
  readonly Depth: (typeof COMMEMORATIVE_NFT_TRAIT_VALUES.Depth)[number]
  readonly Gasveteran: (typeof COMMEMORATIVE_NFT_TRAIT_VALUES.Gasveteran)[number]
  readonly Archetype: (typeof COMMEMORATIVE_NFT_TRAIT_VALUES.Archetype)[number]
  readonly Rarity: (typeof COMMEMORATIVE_NFT_TRAIT_VALUES.Rarity)[number]
  readonly Seed: number
}

export type CommemorativeNftAssets = {
  readonly metadataUrl?: string
  readonly imageUrl?: string
  readonly animationUrl?: string
  readonly externalUrl?: string
}

export type CommemorativeNftEligibilitySource =
  | 'remote'
  | 'dev-fixture'
  | 'preview'

export type CommemorativeNftEligibility = {
  readonly ownerAddress: Address
  readonly profileName: string
  readonly rendererName: string
  readonly proof: readonly Hex[]
  readonly traits: RendererTraits
  readonly assets: CommemorativeNftAssets
  readonly source: CommemorativeNftEligibilitySource
}

export type CommemorativeNftEligibilityResult =
  | {
      readonly status: 'eligible'
      readonly eligibility: CommemorativeNftEligibility
    }
  | { readonly status: 'ineligible' }
  | { readonly status: 'unavailable' }

export type CommemorativeNftShareUrls = {
  readonly x?: string
  readonly telegram?: string
  readonly external?: string
}
