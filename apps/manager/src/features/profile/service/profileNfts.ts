import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { ok, ResultAsync } from 'neverthrow'
import type { Address } from 'viem'

const DEFAULT_LIMIT = 40
const DEFAULT_CHAIN_ID = 11155111
const DEV_ALCHEMY_API_KEY = 'demo'
const IPFS_HTTP_GATEWAY = 'https://ipfs.euc.li/ipfs/'
const SUPPORTED_NFT_CHAIN_IDS = [11155111] as const

type SupportedNftChainId = (typeof SUPPORTED_NFT_CHAIN_IDS)[number]
type TokenStandard = 'erc721' | 'erc1155'

export type AvatarNft = {
  readonly id: string
  readonly name: string
  readonly image: string
  readonly collection: string
  readonly avatarRecord: string
}

export type AlchemyNft = {
  readonly contract?: {
    readonly address?: string
    readonly name?: string | null
    readonly tokenType?: string | null
  }
  readonly tokenId?: string
  readonly tokenType?: string | null
  readonly name?: string | null
  readonly image?: {
    readonly cachedUrl?: string | null
    readonly thumbnailUrl?: string | null
    readonly pngUrl?: string | null
    readonly originalUrl?: string | null
  }
  readonly collection?: {
    readonly name?: string | null
  }
  readonly raw?: {
    readonly metadata?: {
      readonly image?: string | null
    }
  }
}

type AlchemyNftsResponse = {
  readonly ownedNfts?: readonly AlchemyNft[]
}

export class GetProfileNftsError extends TaggedError('GetProfileNftsError')<{
  cause: unknown
}> {}

const getAlchemyApiKey = () => {
  const value = (
    import.meta.env as unknown as Record<string, string | boolean | undefined>
  ).VITE_ALCHEMY_NFT_API_KEY

  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (import.meta.env.PROD) {
    throw new Error('VITE_ALCHEMY_NFT_API_KEY is required to load NFTs')
  }

  return DEV_ALCHEMY_API_KEY
}

const resolveAlchemyNetwork = (_chainId: SupportedNftChainId) => 'eth-sepolia'

const getTokenStandard = (
  tokenType: string | null | undefined,
): TokenStandard | null => {
  if (tokenType === 'ERC721') return 'erc721'
  if (tokenType === 'ERC1155') return 'erc1155'
  return null
}

const normalizeImageUrl = (imageUrl: string | null | undefined) => {
  if (!imageUrl) return undefined
  if (!imageUrl.startsWith('ipfs://')) return imageUrl

  const path = imageUrl.slice('ipfs://'.length).replace(/^ipfs\//, '')
  if (!path) return undefined

  return `${IPFS_HTTP_GATEWAY}${path}`
}

const getImageUrl = (nft: AlchemyNft) =>
  normalizeImageUrl(
    nft.image?.cachedUrl ??
      nft.image?.thumbnailUrl ??
      nft.image?.pngUrl ??
      nft.image?.originalUrl ??
      nft.raw?.metadata?.image,
  )

const isHexAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value)

const buildAvatarRecord = ({
  chainId,
  contractAddress,
  standard,
  tokenId,
}: {
  readonly chainId: number
  readonly contractAddress: string
  readonly standard: TokenStandard
  readonly tokenId: string
}) =>
  `eip155:${chainId}/${standard}:${contractAddress.toLowerCase()}/${tokenId}`

export const buildAlchemyNftsEndpoint = ({
  address,
  chainId,
  limit,
}: {
  readonly address: Address
  readonly chainId: SupportedNftChainId
  readonly limit: number
}) => {
  const params = new URLSearchParams({
    pageSize: String(limit),
    withMetadata: 'true',
  })
  params.append('excludeFilters[]', 'SPAM')

  return `https://${resolveAlchemyNetwork(
    chainId,
  )}.g.alchemy.com/nft/v3/${getAlchemyApiKey()}/getNFTsForOwner?owner=${address}&${params.toString()}`
}

export const getNftChainPriority = (
  _chainId: number | undefined,
): readonly SupportedNftChainId[] => {
  return [11155111]
}

export const mapAlchemyNftsToAvatarNfts = ({
  chainId,
  nfts,
}: {
  readonly chainId: SupportedNftChainId
  readonly nfts: readonly AlchemyNft[]
}): AvatarNft[] =>
  nfts.flatMap((nft) => {
    const standard = getTokenStandard(nft.tokenType ?? nft.contract?.tokenType)
    const contractAddress = nft.contract?.address
    const tokenId = nft.tokenId
    const image = getImageUrl(nft)

    if (
      !standard ||
      !contractAddress ||
      !isHexAddress(contractAddress) ||
      !tokenId ||
      !image
    ) {
      return []
    }

    const normalizedContractAddress = contractAddress.toLowerCase()
    const name = nft.name?.trim() || `#${tokenId}`
    const collection =
      nft.collection?.name?.trim() ||
      nft.contract?.name?.trim() ||
      'Unknown collection'

    return [
      {
        avatarRecord: buildAvatarRecord({
          chainId,
          contractAddress,
          standard,
          tokenId,
        }),
        collection,
        id: `${chainId}:${normalizedContractAddress}:${tokenId}`,
        image,
        name,
      },
    ]
  })

const fetchNftsForChain = async ({
  address,
  chainId,
  limit,
}: {
  readonly address: Address
  readonly chainId: SupportedNftChainId
  readonly limit: number
}) => {
  const response = await fetch(
    buildAlchemyNftsEndpoint({ address, chainId, limit }),
    {
      headers: {
        Accept: 'application/json',
      },
      method: 'GET',
    },
  )

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}` }))
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : `HTTP ${response.status}`

    throw new Error(`Failed to fetch profile NFTs: ${message}`)
  }

  const payload = (await response.json()) as AlchemyNftsResponse
  return mapAlchemyNftsToAvatarNfts({
    chainId,
    nfts: payload.ownedNfts ?? [],
  })
}

export const getProfileNfts = ResultFn(async function* ({
  address,
  chainId = DEFAULT_CHAIN_ID,
  limit = DEFAULT_LIMIT,
}: {
  readonly address: Address
  readonly chainId?: number
  readonly limit?: number
}) {
  const nfts = yield* await ResultAsync.fromPromise(
    (async () => {
      const merged = new Map<string, AvatarNft>()

      for (const targetChainId of getNftChainPriority(chainId)) {
        const chainNfts = await fetchNftsForChain({
          address,
          chainId: targetChainId,
          limit,
        })

        for (const nft of chainNfts) {
          merged.set(nft.id, nft)
        }

        if (merged.size >= limit) break
      }

      return Array.from(merged.values()).slice(0, limit)
    })(),
    (error) =>
      new GetProfileNftsError({
        cause: error,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to fetch profile NFTs',
      }),
  )

  return ok(nfts)
})

export const profileNftsQuery = ({
  address,
  chainId,
  limit = DEFAULT_LIMIT,
}: {
  readonly address?: Address
  readonly chainId?: number
  readonly limit?: number
}) =>
  resultQueryOptions({
    queryKey: qk('profile', 'nfts', {
      address: address?.toLowerCase(),
      chainId: chainId ?? DEFAULT_CHAIN_ID,
      limit,
    }),
    queryFn: () =>
      address ? getProfileNfts({ address, chainId, limit }) : ok([]),
  })
