import type { Address } from 'viem'
import { mainnet } from 'viem/chains'
import {
  getCommemorativeNftContractAddress,
  getCommemorativeNftTokenId,
} from './config'
import type { CommemorativeNftShareUrls } from './types'

const normalizedProfileName = (name: string) =>
  name.trim().replace(/\.$/, '').toLowerCase()

const getManagerOrigin = (): string =>
  typeof window === 'undefined'
    ? 'https://app.ens.domains'
    : window.location.origin

export const buildCommemorativeNftProfileUrl = (
  profileName: string,
  origin = getManagerOrigin(),
): string =>
  new URL(
    `/p/${encodeURIComponent(normalizedProfileName(profileName))}`,
    origin,
  ).toString()

export const isCommemorativeNftCanonicalProfile = (
  routeName: string,
  profileName: string,
): boolean =>
  normalizedProfileName(routeName) === normalizedProfileName(profileName)

export const buildCommemorativeNftShareUrls = (
  externalUrl: string | undefined,
): CommemorativeNftShareUrls => {
  if (!externalUrl) return {}

  const text = 'I upgraded to ENSv2 and minted my commemorative NFT.'
  return {
    external: externalUrl,
    x: `https://x.com/intent/post?${new URLSearchParams({ text, url: externalUrl })}`,
    telegram: `https://t.me/share/url?${new URLSearchParams({ text, url: externalUrl })}`,
  }
}

export const buildCommemorativeNftMarketplaceUrl = (params: {
  readonly chainId: number
  readonly ownerAddress: Address
  readonly minted: boolean
}): string | undefined => {
  if (!params.minted || params.chainId !== mainnet.id) return undefined

  const contractAddress = getCommemorativeNftContractAddress(params.chainId)
  if (!contractAddress) return undefined

  const tokenId = getCommemorativeNftTokenId(params.ownerAddress).toString()
  return `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`
}
