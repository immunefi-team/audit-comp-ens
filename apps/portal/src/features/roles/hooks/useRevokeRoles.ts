/**
 * React hook wrapper for revokeRoles.
 *
 * Provides a mutation that revokes roles via the transaction manager.
 * Invalidates name roles queries on success with indexer sync polling.
 */

import type { Role } from '@ensdomains/ensjs/utils/v2'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Address } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import { sepoliaWithEns } from '@/lib/wagmi'
import { pollForIndexerSync } from '@/utils/query/pollForIndexerSync'
import { revokeRoles } from '../helpers/revokeRoles'
import { invalidateRolesQueries } from '../utils/invalidateRolesQueries'

type UseRevokeRolesParameters = {
  readonly name: string
  readonly account: Address
  readonly roles: Role[]
  readonly id: string
  readonly registryAddress: Address
}

export function useRevokeRoles() {
  const chainId = sepoliaWithEns.id
  const queryClient = useQueryClient()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const mutation = useMutation({
    mutationFn: async (params: UseRevokeRolesParameters) => {
      if (!walletClient?.account || !publicClient) {
        throw new Error('Wallet not connected')
      }

      return revokeRoles({
        ...params,
        walletClient,
        publicClient,
        signer: createEOASigner(walletClient),
        chainId,
        registryAddress: params.registryAddress,
      })
    },
    onSuccess: () => {
      invalidateRolesQueries(queryClient)
      pollForIndexerSync({
        invalidateQueries: () => invalidateRolesQueries(queryClient),
      })
    },
  })

  return {
    revokeRoles: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  }
}
