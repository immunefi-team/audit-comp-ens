import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import type { ResolverRole } from '@ensdomains/ensjs/public/v2'
import { grantResolverRolesWriteParameters } from '@ensdomains/ensjs/wallet/v2'
import {
  type Address,
  encodeFunctionData,
  type Hash,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { toEoaCustomIntent } from '@/features/transaction-manager/helpers/intents'

export interface GrantResolverRolesTransactionParameters {
  readonly resolverAddress: Address
  /** Dotted name (e.g. "myname.eth") or empty string for ROOT_RESOURCE (all names). */
  readonly name: string
  readonly account: Address
  readonly roles: ResolverRole[]
  readonly walletClient: WalletClient
  readonly chainId: number
}

/** The grantRoles intent, shared by the gas estimate and `grantResolverRoles`. */
export const prepareGrantResolverRolesTransaction = ({
  resolverAddress,
  name,
  account,
  roles,
  walletClient,
  chainId,
}: GrantResolverRolesTransactionParameters): CustomTransactionIntent => {
  if (!walletClient.account || !walletClient.chain) {
    throw new Error('Wallet client must have account and chain configured')
  }

  if (roles.length === 0) {
    throw new Error('At least one role must be selected')
  }

  const writeParams = grantResolverRolesWriteParameters(
    walletClient as Parameters<typeof grantResolverRolesWriteParameters>[0],
    name === ''
      ? {
          resolverAddress,
          targetAccount: account,
          scope: 'root',
          roles,
        }
      : {
          resolverAddress,
          targetAccount: account,
          scope: 'name',
          name,
          roles,
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

export interface GrantResolverRolesParameters
  extends GrantResolverRolesTransactionParameters {
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly id: string
}

export const grantResolverRoles = async (
  params: GrantResolverRolesParameters,
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
    prepareGrantResolverRolesTransaction({
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
      description: `Grant resolver roles for ${name || '(root)'}`,
      publicClient,
      chainId,
    },
  )

  const result = await waitForTransaction(txId)
  return result.hash
}
