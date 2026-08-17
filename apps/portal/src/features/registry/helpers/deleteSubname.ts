/**
 * Pure async function to delete a subname.
 *
 * Prepares the deleteSubname transaction, starts it through
 * the transaction manager, and waits for completion.
 */

import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { prepareDeleteSubnameTransaction } from '../utils/delete-subname.helpers'

export interface DeleteSubnameParameters {
  /** The full subname (e.g., 'cold.domico.eth') – used for tx description */
  readonly name: string
  /** The label of the subname (e.g., 'cold' for cold.domico.eth) */
  readonly label: string
  /** The parent registry (subregistry) address that manages this subname */
  readonly registryAddress: Address
  /** Transaction id used by transactionManager and TransactionModal */
  readonly id: string
  readonly walletClient: WalletClient
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly chainId: number
}

export interface DeleteSubnameResult {
  readonly txId: string
  readonly hash: Hex
}

export const deleteSubname = async (
  params: DeleteSubnameParameters,
): Promise<DeleteSubnameResult> => {
  const {
    name,
    label,
    registryAddress,
    id,
    walletClient,
    publicClient,
    signer,
    chainId,
  } = params

  const intent = prepareDeleteSubnameTransaction({
    registryAddress,
    label,
    walletClient,
    chainId,
  })

  const txId = transactionManager.startTransaction(intent, signer, {
    id,
    description: `Delete subname ${name}`,
    publicClient,
    chainId,
  })

  const result = await waitForTransaction(txId)

  return {
    txId,
    hash: result.hash,
  }
}
