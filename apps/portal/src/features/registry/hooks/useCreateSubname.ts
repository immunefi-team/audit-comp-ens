/**
 * React hook wrapper for createSubname.
 *
 * Provides a mutation with loading/error states for the UI.
 * Invalidates subnames query on success with indexer sync polling.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useWalletClient } from 'wagmi'
import { getSubnamesQueryOptions } from '@/features/profile/hooks/useSubnames'
import { sepoliaWithEns } from '@/lib/wagmi'
import { pollForIndexerSync } from '@/utils/query/pollForIndexerSync'
import {
  type CreateSubnameParameters,
  createSubname,
} from '../helpers/createSubname'
import { createEOASigner } from '../utils/signer.helpers'

type UseCreateSubnameParameters = Omit<
  CreateSubnameParameters,
  'walletClient' | 'signer' | 'chainId'
>

export function useCreateSubname() {
  const chainId = sepoliaWithEns.id
  const queryClient = useQueryClient()
  const { data: walletClient } = useWalletClient()

  const mutation = useMutation({
    mutationFn: async (params: UseCreateSubnameParameters) => {
      if (!walletClient) {
        throw new Error('Wallet not connected')
      }

      const signer = createEOASigner(walletClient)

      return createSubname({
        ...params,
        walletClient,
        signer,
        chainId,
      })
    },
    onSuccess: (_data, variables) => {
      const subnamesQueryKey = getSubnamesQueryOptions({
        name: variables.parentName,
        protocolVersion: variables.protocolVersion,
      }).queryKey

      queryClient.invalidateQueries({
        queryKey: subnamesQueryKey,
        refetchType: 'all',
      })

      pollForIndexerSync({
        invalidateQueries: () =>
          queryClient.invalidateQueries({
            queryKey: subnamesQueryKey,
            refetchType: 'all',
          }),
      })
    },
  })

  return {
    createSubname: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    reset: mutation.reset,
  }
}
