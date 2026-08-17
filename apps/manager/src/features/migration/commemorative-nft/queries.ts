import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { type QueryClient, queryOptions } from '@tanstack/react-query'
import type { Config as WagmiConfig } from '@wagmi/core'
import type { Address } from 'viem'
import { getCommemorativeNftConfig } from './config'
import { readCommemorativeNftClaimed } from './contract'
import { fetchCommemorativeNftEligibility } from './eligibility'

export const getCommemorativeNftClaimedRefetchInterval = (params: {
  readonly poll: boolean
  readonly claimed: boolean | undefined
}): 2_000 | false => (params.poll && params.claimed !== true ? 2_000 : false)

export const commemorativeNftEligibilityQueryOptions = (params: {
  readonly ownerAddress: Address
  readonly allowDevFixture?: boolean
}) => {
  const config = getCommemorativeNftConfig()

  return queryOptions({
    queryKey: qk('commemorative_nft', 'eligibility', {
      ownerAddress: params.ownerAddress.toLowerCase(),
    }),
    queryFn: () =>
      fetchCommemorativeNftEligibility({
        ownerAddress: params.ownerAddress,
        eligibilityOrigin: config.eligibilityOrigin,
        assetOrigin: config.assetOrigin,
        allowDevFixture: params.allowDevFixture,
      }),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export const commemorativeNftClaimedQueryOptions = (params: {
  readonly ownerAddress: Address
  readonly chainId: number
  readonly wagmiConfig: WagmiConfig
  readonly poll?: boolean
}) =>
  queryOptions({
    queryKey: qk('commemorative_nft', 'claimed', {
      chainId: params.chainId,
      ownerAddress: params.ownerAddress.toLowerCase(),
    }),
    queryFn: () => readCommemorativeNftClaimed(params),
    refetchInterval: (query) =>
      getCommemorativeNftClaimedRefetchInterval({
        poll: params.poll === true,
        claimed: query.state.data,
      }),
    staleTime: 0,
  })

export const invalidateCommemorativeNftStatus = async (params: {
  readonly queryClient: QueryClient
  readonly ownerAddress: Address
  readonly chainId: number
}): Promise<void> => {
  await params.queryClient.invalidateQueries({
    queryKey: qk('commemorative_nft', 'claimed', {
      chainId: params.chainId,
      ownerAddress: params.ownerAddress.toLowerCase(),
    }),
  })
}
