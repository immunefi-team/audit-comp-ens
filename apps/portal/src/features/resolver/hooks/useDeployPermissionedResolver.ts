import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type Address, encodeFunctionData, type Hash, parseAbi } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { createEOASigner } from '@/features/registry/utils/signer.helpers'
import {
  generateResolverSalt,
  getResolverInitCalldata,
  parseProxyDeployedAddress,
} from '@/features/resolver/utils/permissionedResolver'
import { toEoaCustomIntent } from '@/features/transaction-manager/helpers/intents'
import { sepoliaWithEns } from '@/lib/wagmi'
import { pollForIndexerSync } from '@/utils/query/pollForIndexerSync'
import { invalidateResolverQueries } from '../utils/invalidateResolverQueries'

const verifiableFactoryAbi = parseAbi([
  'function deployProxy(address implementation, uint256 salt, bytes data)',
  'event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)',
])

interface DeployPermissionedResolverResult {
  txId: string
  hash: Hash
  resolverAddress: Address
}

interface UseDeployPermissionedResolverParams {
  readonly name: string
}

const permissionedResolverImpl = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensPermissionedResolverImpl',
})

const verifiableFactory = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensVerifiableFactory',
})

export interface DeployPermissionedResolverTransactionParameters {
  readonly from: Address
  readonly chainId: number
  /**
   * CREATE2 salt for the proxy. Generated fresh per deploy attempt via
   * `generateResolverSalt`. The modal's pre-start gas estimate passes a stable
   * throwaway salt instead — deploy gas is independent of the salt value, so the
   * estimate is accurate without needing the exact salt the submit will use.
   */
  readonly salt: bigint
}

/** The `deployProxy` intent, shared by the gas estimate and `deployPermissionedResolver`. */
export const prepareDeployPermissionedResolverTransaction = ({
  from,
  chainId,
  salt,
}: DeployPermissionedResolverTransactionParameters): CustomTransactionIntent => {
  const deployCalldata = encodeFunctionData({
    abi: verifiableFactoryAbi,
    functionName: 'deployProxy',
    args: [permissionedResolverImpl, salt, getResolverInitCalldata(from)],
  })

  return toEoaCustomIntent({
    from,
    to: verifiableFactory,
    data: deployCalldata,
    chainId,
  })
}

const deployPermissionedResolver = async ({
  name,
  signer,
  publicClient,
  accountAddress,
  chainId,
  id,
}: {
  name: string
  signer: Signer
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>
  accountAddress: Address
  chainId: number
  id: string
}): Promise<DeployPermissionedResolverResult> => {
  const salt = generateResolverSalt(name)
  const intent = prepareDeployPermissionedResolverTransaction({
    from: accountAddress,
    chainId,
    salt,
  })

  const txId = transactionManager.startTransaction(intent, signer, {
    id,
    description: `Deploy permissioned resolver for ${name}`,
    publicClient,
    timeout: 120_000,
  })

  const result = await waitForTransaction(txId)
  const resolverAddress = parseProxyDeployedAddress(result.receipt?.logs ?? [])

  if (!resolverAddress) {
    throw new Error('Could not extract deployed resolver address from receipt')
  }

  return {
    txId,
    hash: result.hash,
    resolverAddress,
  }
}

export const useDeployPermissionedResolver = ({
  name,
}: UseDeployPermissionedResolverParams) => {
  const chainId = sepoliaWithEns.id
  const queryClient = useQueryClient()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const mutation = useMutation({
    mutationFn: async ({
      id,
    }: {
      id: string
    }): Promise<DeployPermissionedResolverResult> => {
      if (!walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }

      if (!walletClient.account) {
        throw new Error('No account connected')
      }

      const signer = createEOASigner(walletClient)

      return deployPermissionedResolver({
        name,
        signer,
        publicClient,
        accountAddress: walletClient.account.address,
        chainId,
        id,
      })
    },
    onSuccess: () => {
      invalidateResolverQueries(queryClient)
      pollForIndexerSync({
        invalidateQueries: () => invalidateResolverQueries(queryClient),
      })
    },
  })

  return {
    deployPermissionedResolver: mutation.mutate,
    deployPermissionedResolverAsync: mutation.mutateAsync,
    txHash: mutation.data?.hash,
    deployedResolverAddress: mutation.data?.resolverAddress,
    isWriting: mutation.isPending,
    isConfirming: mutation.isPending,
    isConfirmed: mutation.isSuccess,
    error: mutation.error,
    reset: mutation.reset,
    hasWallet: Boolean(walletClient?.account),
  }
}
