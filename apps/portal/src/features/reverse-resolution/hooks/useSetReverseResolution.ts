/**
 * React hook for setting reverse resolution (address → name) via transactionManager.
 *
 * Wraps the setReverseResolution helper in a TanStack mutation.
 * Invalidates the reverse resolution query on success so the UI updates.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Hex } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import {
  type SetReverseResolutionParameters,
  setReverseResolution,
} from '../helpers/setReverseResolution'

type WriteRequest = SetReverseResolutionParameters['request']

interface UseSetReverseResolutionParams {
  readonly chainId: number
  readonly id: string
}

export const useSetReverseResolution = ({
  chainId,
  id,
}: UseSetReverseResolutionParams) => {
  const queryClient = useQueryClient()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const mutation = useMutation({
    mutationFn: async (params: {
      name: string
      request: WriteRequest
    }): Promise<{ txId: string; hash: Hex }> => {
      if (!walletClient?.account || !publicClient) {
        throw new Error('Wallet not connected')
      }
      const signer = createEOASigner(walletClient)
      return setReverseResolution({
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
      // Reverse-resolution table reads from ['get-reverse-resolution'];
      // the explorer-wide primary name displayed in WalletMenu and elsewhere
      // is a separate query (see `usePrimaryName`) keyed under
      // ['get-primary-name'] that hits a batch reverse resolver. Both must
      // be invalidated to keep the UI in sync after a setName.
      queryClient.invalidateQueries({ queryKey: ['get-reverse-resolution'] })
      queryClient.invalidateQueries({ queryKey: ['get-primary-name'] })
    },
  })

  return {
    setReverseResolution: mutation.mutate,
    setReverseResolutionAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
    hasWallet: Boolean(walletClient?.account),
  }
}
