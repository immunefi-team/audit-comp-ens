/**
 * React hook for setting forward resolution (primary name) via transactionManager.
 *
 * Wraps the setForwardResolution helper in a TanStack mutation.
 * Invalidates the reverse resolution query on success so the UI updates.
 */

import type { SetForwardResolutionRequest } from '@ens-apps/l2-primary/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Hex } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import { setForwardResolution } from '../helpers/setForwardResolution'

interface UseSetForwardResolutionParams {
  readonly chainId: number
  readonly id: string
}

export const useSetForwardResolution = ({
  chainId,
  id,
}: UseSetForwardResolutionParams) => {
  const queryClient = useQueryClient()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const mutation = useMutation({
    mutationFn: async (params: {
      name: string
      request: SetForwardResolutionRequest
    }): Promise<{ txId: string; hash: Hex }> => {
      if (!walletClient?.account || !publicClient) {
        throw new Error('Wallet not connected')
      }
      const signer = createEOASigner(walletClient)
      return setForwardResolution({
        name: params.name,
        request: params.request,
        walletClient,
        publicClient,
        signer,
        chainId,
        id,
      })
    },
    onSuccess: () => {
      // Setting a forward resolution (primary name → address) changes which
      // names resolve back to the connected wallet. Both the reverse table
      // and the explorer-wide primary-name query need to refetch.
      queryClient.invalidateQueries({ queryKey: ['get-reverse-resolution'] })
      queryClient.invalidateQueries({ queryKey: ['get-primary-name'] })
    },
  })

  return {
    setForwardResolution: mutation.mutate,
    setForwardResolutionAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    hasWallet: Boolean(walletClient?.account),
  }
}
