/**
 * React hook wrapper for revokeRegistryRoles.
 *
 * Symmetric to `useGrantRegistryRolesMutation`. Invalidates `get-registry-roles` on
 * success with indexer-sync polling so RegistryRolesTable refreshes.
 */

import type { Role } from '@ensdomains/ensjs/utils/v2'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Address } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { invalidateRegistryQueries } from '@/features/registry/utils/invalidateRegistryQueries'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import { sepoliaWithEns } from '@/lib/wagmi'
import { pollForIndexerSync } from '@/utils/query/pollForIndexerSync'
import { revokeRegistryRoles } from '../helpers/revokeRegistryRoles'

type UseRevokeRegistryRolesParameters = {
  readonly registryAddress: Address
  readonly account: Address
  readonly roles: Role[]
  readonly id: string
}

export function useRevokeRegistryRolesMutation() {
  const chainId = sepoliaWithEns.id
  const queryClient = useQueryClient()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const invalidate = () => invalidateRegistryQueries(queryClient)

  const mutation = useMutation({
    mutationFn: async (params: UseRevokeRegistryRolesParameters) => {
      if (!walletClient?.account || !publicClient) {
        throw new Error('Wallet not connected')
      }
      return revokeRegistryRoles({
        ...params,
        walletClient,
        publicClient,
        signer: createEOASigner(walletClient),
        chainId,
      })
    },
    onSuccess: () => {
      invalidate()
      pollForIndexerSync({ invalidateQueries: invalidate })
    },
  })

  return {
    revokeRegistryRoles: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  }
}
