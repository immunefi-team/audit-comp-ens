import {
  createSetForwardResolutionRequest,
  createSetReverseNameRequest,
  type SetForwardResolutionRequest,
  type SetReverseNameRequest,
} from '@ens-apps/l2-primary/utils'
import {
  getRegistrarAddress,
  type ReverseRegistrarChainId,
} from '@ens-apps/l2-primary/v1'
import { reverseRegistrarSetNameSnippet } from '@ensdomains/ensjs-abi/reverseRegistrar'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type { Address } from 'viem'
import { normalize } from 'viem/ens'
import { useConnection, useWalletClient } from 'wagmi'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { getNameResolverAddressQueryOptions } from '@/features/records/hooks/useNameResolverAddress'
import { isL1ReverseRegistrarChainId } from '@/lib/reverseRegistrarChainId'

type UseReverseResolutionMutationsParams = {
  reverseRegistrarChainId: ReverseRegistrarChainId
  /**
   * ENSIP-9/11 coin type of the selected row (`60`, `0x80000000 | l2ChainId`,
   * …) — the coin the forward `addr(node, coinType)` record is keyed on.
   */
  coinType: number
  displayName: string | undefined
}

type ReverseResolutionWriteRequest =
  | {
      kind: 'l1-v1-direct'
      request: {
        address: Address
        abi: typeof reverseRegistrarSetNameSnippet
        functionName: 'setName'
        args: readonly [name: string]
      }
    }
  | {
      kind: 'l2'
      request: SetReverseNameRequest
    }

export function useReverseResolutionMutations({
  reverseRegistrarChainId,
  coinType,
  displayName,
}: UseReverseResolutionMutationsParams) {
  const queryClient = useQueryClient()
  const { chain } = useConnection()

  const isL1 = useMemo(
    () => isL1ReverseRegistrarChainId(reverseRegistrarChainId),
    [reverseRegistrarChainId],
  )

  const { data: l1WalletClient } = useWalletClient()

  const { isLoading: isEnsOwnerLoading } = useQuery({
    ...getEnsOwnerQueryOptions({ name: displayName }),
    enabled: Boolean(displayName),
  })

  // The name's resolver lives on L1 for every row — L2 forward records
  // (`addr(node, l2CoinType)`) are set on the same L1 resolver as coin 60.
  const { data: resolverAddress } = useQuery({
    ...getNameResolverAddressQueryOptions({
      name: displayName ?? '',
    }),
    enabled: Boolean(displayName),
  })

  const invalidateReverseResolutionQuery = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['get-reverse-resolution'] })
  }, [queryClient])

  // Reverse resolution always goes through the ENSv1 `ReverseRegistrar` on
  // L1 and the ENSv1 `L2ReverseRegistrar` on L2 — both accept `setName(string)`
  // for any UTF-8 string (V1 name, V2 name, subname, DNS-imported, even
  // a non-existent name), so we don't gate the input on existence or
  // protocol version at all.
  const getReverseResolutionRequest = useCallback(
    (name: string): ReverseResolutionWriteRequest => {
      const normalizedName = normalize(name)

      if (isL1) {
        if (!l1WalletClient)
          throw new Error('Sepolia wallet client not available')
        if (!l1WalletClient.account) throw new Error('No connected account')

        return {
          kind: 'l1-v1-direct',
          request: {
            // biome-ignore lint/style/noNonNullAssertion: coinType 60 always has a sepolia address
            address: getRegistrarAddress(60)!,
            abi: reverseRegistrarSetNameSnippet,
            functionName: 'setName',
            args: [normalizedName] as const,
          },
        }
      }

      return {
        kind: 'l2',
        request: createSetReverseNameRequest({
          name: normalizedName,
          reverseRegistrarChainId,
          chain,
        }),
      }
    },
    [chain, isL1, l1WalletClient, reverseRegistrarChainId],
  )

  // Builds the forward `setAddr(node, coinType, address)` request against the
  // name's L1 resolver. Valid for L1 and L2 rows alike — the coin type keys
  // which chain's address record is written (ENSIP-19), the tx itself is
  // always an L1 transaction.
  const getForwardResolutionRequest = useCallback(
    (address: Address): SetForwardResolutionRequest => {
      return createSetForwardResolutionRequest({
        name: displayName,
        coinType,
        resolverAddress,
        targetAddress: address,
      })
    },
    [displayName, coinType, resolverAddress],
  )

  return {
    getReverseResolutionRequest,
    getForwardResolutionRequest,
    invalidateReverseResolutionQuery,
    isEnsOwnerLoading,
  }
}
