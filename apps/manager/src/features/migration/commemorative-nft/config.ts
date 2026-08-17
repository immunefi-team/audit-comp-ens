import { type Address, getAddress, keccak256 } from 'viem'
import { sepolia } from 'viem/chains'
import type {
  CommemorativeNftAssets,
  CommemorativeNftEligibility,
} from './types'

export const COMMEMORATIVE_NFT_SEPOLIA_ADDRESS = getAddress(
  '0xe49A9D706FCD82AA575496352B5633F80fBBC449',
)

export const DEFAULT_COMMEMORATIVE_NFT_RENDERER_ORIGIN =
  'https://ens-renderer.pages.dev'

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const optionalOrigin = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimTrailingSlash(trimmed) : undefined
}

export const getCommemorativeNftConfig = () => ({
  assetOrigin: optionalOrigin(
    import.meta.env.VITE_COMMEMORATIVE_NFT_ASSET_ORIGIN,
  ),
  eligibilityOrigin: optionalOrigin(
    import.meta.env.VITE_COMMEMORATIVE_NFT_ELIGIBILITY_ORIGIN,
  ),
  rendererOrigin:
    optionalOrigin(import.meta.env.VITE_COMMEMORATIVE_NFT_RENDERER_ORIGIN) ??
    DEFAULT_COMMEMORATIVE_NFT_RENDERER_ORIGIN,
})

export const getCommemorativeNftContractAddress = (
  chainId: number,
): Address | undefined =>
  chainId === sepolia.id ? COMMEMORATIVE_NFT_SEPOLIA_ADDRESS : undefined

export const getCommemorativeNftTokenId = (ownerAddress: Address): bigint =>
  BigInt(keccak256(ownerAddress))

export const buildCommemorativeNftEligibilityUrl = (
  eligibilityOrigin: string,
  ownerAddress: Address,
): string =>
  `${trimTrailingSlash(eligibilityOrigin)}/${ownerAddress.toLowerCase()}.json`

export const buildCommemorativeNftAssets = (
  assetOrigin: string | undefined,
  ownerAddress: Address,
): CommemorativeNftAssets => {
  if (!assetOrigin) return {}

  const tokenId = getCommemorativeNftTokenId(ownerAddress).toString()
  const origin = trimTrailingSlash(assetOrigin)

  return {
    metadataUrl: `${origin}/${tokenId}.json`,
    imageUrl: `${origin}/${tokenId}.png`,
    animationUrl: `${origin}/${tokenId}.mp4`,
  }
}

const rendererAttributes = (traits: CommemorativeNftEligibility['traits']) => [
  { trait_type: 'Era', value: traits.Era },
  { trait_type: 'Depth', value: traits.Depth },
  { trait_type: 'Gasveteran', value: traits.Gasveteran },
  { trait_type: 'Archetype', value: traits.Archetype },
  // Metadata keeps the pipeline value; the renderer derives visual rarity from metadata.name.
  { trait_type: 'Rarity', value: traits.Rarity },
  { trait_type: 'Seed', value: traits.Seed },
]

export const buildCommemorativeNftRendererUrl = (params: {
  readonly eligibility: CommemorativeNftEligibility
  readonly rendererOrigin: string
}): string => {
  const metadata = {
    name: params.eligibility.rendererName,
    description: 'A commemorative NFT marking the migration to ENSv2.',
    image: '',
    animation_url: '',
    attributes: rendererAttributes(params.eligibility.traits),
  }
  // `data:` is part of the renderer contract; WEB-604's allowlist must permit it.
  const tokenUri = `data:application/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(metadata),
  )}`
  const rendererUrl = new URL(trimTrailingSlash(params.rendererOrigin))
  rendererUrl.searchParams.set('tokenURI', tokenUri)
  rendererUrl.searchParams.set('transparent', '1')
  return rendererUrl.toString()
}
