import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Address, PublicClient, WalletClient } from 'viem'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import { deleteAlias } from '@/features/resolver/helpers/setAlias'
import {
  getResolverOverviewQueryOptions,
  type ResolverOverview,
} from '@/features/resolver/hooks/useResolverOverview'
import { pollForIndexerSync } from '@/utils/query/pollForIndexerSync'

interface UseDeleteAliasOptions {
  readonly resolverAddress: Address
  readonly walletClient: WalletClient | undefined
  readonly publicClient: PublicClient | undefined
  readonly chainId: number
  readonly id: string
}

export const useDeleteAlias = ({
  resolverAddress,
  walletClient,
  publicClient,
  chainId,
  id,
}: UseDeleteAliasOptions) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (fromName: string) => {
      if (!walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }
      return deleteAlias({
        fromName,
        resolverAddress,
        walletClient,
        publicClient,
        signer: createEOASigner(walletClient),
        chainId,
        id,
      })
    },
    onSuccess: async (_result, fromName) => {
      const resolverOverviewQueryKey = getResolverOverviewQueryOptions({
        address: resolverAddress,
      }).queryKey

      queryClient.setQueryData<ResolverOverview | null>(
        resolverOverviewQueryKey,
        (current) => {
          if (!current) return current
          return {
            ...current,
            aliases: current.aliases.filter((a) => a.fromName !== fromName),
            aliasCount: Math.max(0, current.aliasCount - 1),
          }
        },
      )

      await pollForIndexerSync({
        invalidateQueries: () =>
          queryClient.invalidateQueries({
            queryKey: ['resolver-overview'],
            refetchType: 'all',
          }),
      })
    },
  })
}
