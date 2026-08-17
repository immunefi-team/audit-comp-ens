import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Address, PublicClient, WalletClient } from 'viem'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import { setAlias } from '@/features/resolver/helpers/setAlias'
import { pollForIndexerSync } from '@/utils/query/pollForIndexerSync'

interface UseSetAliasOptions {
  readonly resolverAddress: Address
  readonly walletClient: WalletClient | undefined
  readonly publicClient: PublicClient | undefined
  readonly chainId: number
  readonly id: string
  readonly onSuccess?: () => void
}

interface SetAliasMutationParams {
  readonly fromName: string
  readonly toName: string
}

export const useSetAlias = ({
  resolverAddress,
  walletClient,
  publicClient,
  chainId,
  id,
  onSuccess,
}: UseSetAliasOptions) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ fromName, toName }: SetAliasMutationParams) => {
      if (!walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }
      return setAlias({
        fromName,
        toName,
        resolverAddress,
        walletClient,
        publicClient,
        signer: createEOASigner(walletClient),
        chainId,
        id,
      })
    },
    onSuccess: async () => {
      await pollForIndexerSync({
        invalidateQueries: () =>
          queryClient.invalidateQueries({
            queryKey: ['resolver-overview'],
            refetchType: 'all',
          }),
      })
      onSuccess?.()
    },
  })
}
