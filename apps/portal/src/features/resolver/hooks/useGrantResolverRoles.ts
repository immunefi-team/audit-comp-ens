import type { ResolverRole } from '@ensdomains/ensjs/public/v2'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Address, PublicClient, WalletClient } from 'viem'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import { grantResolverRoles } from '@/features/resolver/helpers/grantResolverRoles'
import { pollForIndexerSync } from '@/utils/query/pollForIndexerSync'

interface UseGrantResolverRolesOptions {
  readonly resolverAddress: Address
  readonly walletClient: WalletClient | undefined
  readonly publicClient: PublicClient | undefined
  readonly chainId: number
  readonly id: string
  readonly onSuccess?: () => void
}

interface GrantResolverRolesMutationParams {
  readonly name: string
  readonly account: Address
  readonly roles: ResolverRole[]
}

export const useGrantResolverRoles = ({
  resolverAddress,
  walletClient,
  publicClient,
  chainId,
  id,
  onSuccess,
}: UseGrantResolverRolesOptions) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      name,
      account,
      roles,
    }: GrantResolverRolesMutationParams) => {
      if (!walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }
      return grantResolverRoles({
        resolverAddress,
        name,
        account,
        roles,
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
