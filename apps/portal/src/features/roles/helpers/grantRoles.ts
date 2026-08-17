/**
 * Pure async function to grant roles on an ENS V2 registry name.
 *
 * Uses ensjs's grantRolesWriteParameters to build the transaction,
 * then sends it through the transaction manager.
 */

import {
  type CustomTransactionIntent,
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import { makeLabelNodeAndParent } from '@ensdomains/ensjs/utils'
import { labelToCanonicalId, type Role } from '@ensdomains/ensjs/utils/v2'
import { grantRolesWriteParameters } from '@ensdomains/ensjs/wallet/v2'
import {
  type Address,
  encodeFunctionData,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { toEoaCustomIntent } from '@/features/transaction-manager/helpers/intents'

// ============================================================================
// Types
// ============================================================================

export type GrantRolesTransactionParameters = {
  readonly name: string
  readonly account: Address
  readonly roles: readonly Role[]
  readonly walletClient: WalletClient
  readonly chainId: number
  readonly registryAddress: Address
}

export type GrantRolesParameters = GrantRolesTransactionParameters & {
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly id: string
}

export interface GrantRolesResult {
  txId: string
  hash: Hex
}

// ============================================================================
// Public API
// ============================================================================

/**
 * The grant-roles intent, shared by the gas estimate and {@link grantRoles}.
 * Requires a walletClient with `account` and `chain` configured.
 */
export function prepareGrantRolesTransaction({
  name,
  account,
  roles,
  walletClient,
  chainId,
  registryAddress,
}: GrantRolesTransactionParameters): CustomTransactionIntent {
  if (!walletClient.account || !walletClient.chain) {
    throw new Error('Wallet client must have account and chain configured')
  }

  const { label } = makeLabelNodeAndParent(name)
  const resource = labelToCanonicalId(label)

  const writeParams = grantRolesWriteParameters(
    walletClient as Parameters<typeof grantRolesWriteParameters>[0],
    {
      registryAddress,
      account,
      resource,
      roles: [...roles],
    },
  )

  const data = encodeFunctionData({
    abi: writeParams.abi,
    functionName: writeParams.functionName,
    args: writeParams.args,
  } as Parameters<typeof encodeFunctionData>[0])

  return toEoaCustomIntent({
    from: walletClient.account.address,
    to: registryAddress,
    data,
    chainId,
  })
}

export async function grantRoles(
  params: GrantRolesParameters,
): Promise<GrantRolesResult> {
  const { name, publicClient, signer, chainId, id } = params

  if (params.roles.length === 0) {
    throw new Error('At least one role must be selected')
  }

  const intent = prepareGrantRolesTransaction(params)

  const txId = transactionManager.startTransaction(intent, signer, {
    id,
    description: `Grant roles for ${name}`,
    publicClient,
    chainId,
  })

  const result = await waitForTransaction(txId)

  return {
    txId,
    hash: result.hash,
  }
}
