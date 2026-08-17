import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { useQuery } from '@tanstack/react-query'
import { type Address, parseAbiItem } from 'viem'
import { usePublicClient } from 'wagmi'
import {
  filterPermissionedResolverAddresses,
  type ProxyDeployedLog,
} from '@/features/resolver/utils/permissionedResolver'
import { sepoliaWithEns } from '@/lib/wagmi'

const verifiableFactory = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensVerifiableFactory',
})

const permissionedResolverImpl = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensPermissionedResolverImpl',
})

const proxyDeployedEvent = parseAbiItem(
  'event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)',
)

interface UseUserPermissionedResolversParams {
  readonly senderAddress?: Address
}

const userPermissionedResolversQueryKey = createQueryKey<
  'user-permissioned-resolvers',
  { senderAddress?: Address }
>('user-permissioned-resolvers')

export const useUserPermissionedResolvers = ({
  senderAddress,
}: UseUserPermissionedResolversParams) => {
  const publicClient = usePublicClient()

  return useQuery({
    queryKey: userPermissionedResolversQueryKey({ senderAddress }),
    enabled: !!senderAddress && !!publicClient,
    queryFn: async () => {
      if (!publicClient || !senderAddress) return []

      const logs = await publicClient.getLogs({
        address: verifiableFactory,
        event: proxyDeployedEvent,
        args: {
          sender: senderAddress,
        },
        fromBlock: 0n,
        toBlock: 'latest',
      })

      return filterPermissionedResolverAddresses(
        logs as ProxyDeployedLog[],
        permissionedResolverImpl,
      )
    },
  })
}
