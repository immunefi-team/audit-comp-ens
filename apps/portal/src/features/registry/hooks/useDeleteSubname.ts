/**
 * React hook wrapper for deleteSubname.
 *
 * Same pattern as useChangeResolver: useMutation with mutationFn that adds
 * walletClient, publicClient, signer, chainId and calls the pure helper.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Address, Hex } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { getSubnamesQueryOptions } from '@/features/profile/hooks/useSubnames'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import { sepoliaWithEns } from '@/lib/wagmi'
import { pollForIndexerSync } from '@/utils/query/pollForIndexerSync'
import { deleteSubname } from '../helpers/deleteSubname'

interface UseDeleteSubnameParams {
  /** The parent name (e.g., 'domico.eth') */
  readonly name: string
  /** The parent subregistry address */
  readonly registryAddress: Address
}

interface DeleteSubnameResult {
  txId: string
  hash: Hex
}

interface DeleteSubnameMutationInput {
  /** The full subname (e.g., 'cold.domico.eth') */
  readonly subname: string
  /** The label portion of the subname (e.g., 'cold') */
  readonly label: string
  /** Transaction id for the transaction manager / modal */
  readonly id: string
}

/**
 * Hook that provides a mutation for deleting (burning) ENS V2 subnames.
 *
 * Uses TanStack Query's useMutation for proper loading/error states.
 * Automatically invalidates the subnames query on success.
 *
 * @example
 * ```ts
 * const { deleteSubnameAsync, isDeleting, error } = useDeleteSubname({
 *   name: 'domico.eth',
 *   registryAddress,
 * })
 *
 * await deleteSubnameAsync({
 *   subname: 'cold.domico.eth',
 *   label: 'cold',
 *   owner: '0x...',
 * })
 * ```
 */
export const useDeleteSubname = ({
  name,
  registryAddress,
}: UseDeleteSubnameParams) => {
  const chainId = sepoliaWithEns.id
  const { data: walletClient } = useWalletClient({ chainId })
  const publicClient = usePublicClient({ chainId })
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (
      input: DeleteSubnameMutationInput,
    ): Promise<DeleteSubnameResult> => {
      if (!walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }

      if (!walletClient.account) {
        throw new Error('No account connected')
      }

      const signer = createEOASigner(walletClient)

      return deleteSubname({
        name: input.subname,
        label: input.label,
        registryAddress,
        id: input.id,
        walletClient,
        publicClient,
        signer,
        chainId,
      })
    },
    onSuccess: () => {
      const subnamesQueryKey = getSubnamesQueryOptions({
        name,
        protocolVersion: 'ENSv2',
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
    deleteSubname: mutation.mutate,
    deleteSubnameAsync: mutation.mutateAsync,
    txHash: mutation.data?.hash,
    isDeleting: mutation.isPending,
    isConfirmed: mutation.isSuccess,
    error: mutation.error,
    reset: mutation.reset,
    hasWallet: !!walletClient,
  }
}
