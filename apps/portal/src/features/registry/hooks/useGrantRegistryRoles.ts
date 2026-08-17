/**
 * React hook wrapper for grantRegistryRoles.
 *
 * Mutation that grants registry-wide (ROOT_RESOURCE) roles via the
 * transaction manager. On success invalidates the registry roles query so
 * the RegistryRolesTable refetches, with indexer-sync polling.
 */

import type { Role } from '@ensdomains/ensjs/utils/v2'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Address } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { invalidateRegistryQueries } from '@/features/registry/utils/invalidateRegistryQueries'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import { sepoliaWithEns } from '@/lib/wagmi'
import { pollForIndexerSync } from '@/utils/query/pollForIndexerSync'
import { grantRegistryRoles } from '../helpers/grantRegistryRoles'

type UseGrantRegistryRolesParameters = {
  readonly registryAddress: Address
  readonly account: Address
  readonly roles: Role[]
  readonly id: string
}

export function useGrantRegistryRolesMutation() {
  const chainId = sepoliaWithEns.id
  const queryClient = useQueryClient()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const invalidate = () => invalidateRegistryQueries(queryClient)

  const mutation = useMutation({
    mutationFn: async (params: UseGrantRegistryRolesParameters) => {
      if (!walletClient?.account || !publicClient) {
        throw new Error('Wallet not connected')
      }
      return grantRegistryRoles({
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
    grantRegistryRoles: mutation.mutate,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  }
}
