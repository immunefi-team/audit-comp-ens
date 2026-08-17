import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import type { ResolverRole } from '@ensdomains/ensjs/public/v2'
import { revokeResolverRolesWriteParameters } from '@ensdomains/ensjs/wallet/v2'
import {
  type Address,
  encodeFunctionData,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { toEoaCustomIntent } from '@/features/transaction-manager/helpers/intents'
import type { ResolverRoleKey } from '@/lib/roles/resolverRoles'

export interface RevokeResolverRolesTransactionParameters {
  readonly resolverAddress: Address
  readonly name: string
  readonly account: Address
  readonly roles: readonly ResolverRoleKey[]
  readonly walletClient: WalletClient
  readonly chainId: number
}

/** The revokeRoles intent, shared by the gas estimate and `revokeResolverRoles`. */
export const prepareRevokeResolverRolesTransaction = ({
  resolverAddress,
  name,
  account,
  roles,
  walletClient,
  chainId,
}: RevokeResolverRolesTransactionParameters): CustomTransactionIntent => {
  if (!walletClient.account || !walletClient.chain) {
    throw new Error('Wallet client must have account and chain configured')
  }

  if (roles.length === 0) {
    throw new Error('At least one role must be selected')
  }

  const writeParams = revokeResolverRolesWriteParameters(
    walletClient as Parameters<typeof revokeResolverRolesWriteParameters>[0],
    name === ''
      ? {
          resolverAddress,
          targetAccount: account,
          scope: 'root',
          roles: roles as ResolverRole[],
        }
      : {
          resolverAddress,
          targetAccount: account,
          scope: 'name',
          name,
          roles: roles as ResolverRole[],
        },
  )

  const data = encodeFunctionData({
    abi: writeParams.abi,
    functionName: writeParams.functionName,
    args: writeParams.args,
  } as Parameters<typeof encodeFunctionData>[0])

  return toEoaCustomIntent({
    from: walletClient.account.address,
    to: resolverAddress,
    data,
    chainId,
  })
}

export interface RevokeResolverRolesParameters
  extends RevokeResolverRolesTransactionParameters {
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly id: string
}

export const revokeResolverRoles = async (
  params: RevokeResolverRolesParameters,
): Promise<Hash> => {
  const {
    resolverAddress,
    name,
    account,
    roles,
    walletClient,
    publicClient,
    signer,
    chainId,
    id,
  } = params

  const txId = transactionManager.startTransaction(
    prepareRevokeResolverRolesTransaction({
      resolverAddress,
      name,
      account,
      roles,
      walletClient,
      chainId,
    }),
    signer,
    {
      id,
      description: `Revoke resolver roles for ${name || '(root)'}`,
      publicClient,
      chainId,
    },
  )
  const result = await waitForTransaction(txId)
  return result.hash
}
