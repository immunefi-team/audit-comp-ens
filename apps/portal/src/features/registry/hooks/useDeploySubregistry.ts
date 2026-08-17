import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Address } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { deploySubregistry } from '@/features/registry/helpers/deploySubregistry'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import { sepoliaWithEns } from '@/lib/wagmi'
import { pollForIndexerSync } from '@/utils/query/pollForIndexerSync'
import { getNameRegistriesQueryOptions } from './useNameRegistryDiscovery'

interface UseDeploySubregistryParams {
  readonly name: string
  readonly factoryAddress: Address
  readonly implAddress: Address
}

export const useDeploySubregistry = ({
  name,
  factoryAddress,
  implAddress,
}: UseDeploySubregistryParams) => {
  const chainId = sepoliaWithEns.id
  const queryClient = useQueryClient()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const mutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!walletClient?.account || !publicClient) {
        throw new Error('Wallet not connected')
      }
      const signer = createEOASigner(walletClient)
      return deploySubregistry({
        factoryAddress,
        implAddress,
        walletClient,
        publicClient,
        signer,
        chainId,
        id,
      })
    },
    onSuccess: () => {
      const invalidate = () =>
        queryClient.invalidateQueries({
          queryKey: getNameRegistriesQueryOptions({ name }).queryKey,
        })
      invalidate()
      pollForIndexerSync({ invalidateQueries: invalidate })
    },
  })

  return {
    deploySubregistry: mutation.mutate,
    deploySubregistryAsync: mutation.mutateAsync,
    txHash: mutation.data?.hash,
    deployedSubregistryAddress: mutation.data?.deployedAddress,
    isWriting: mutation.isPending,
    isConfirming: mutation.isPending,
    isConfirmed: mutation.isSuccess,
    error: mutation.error,
    reset: mutation.reset,
    hasWallet: Boolean(walletClient?.account),
  }
}
