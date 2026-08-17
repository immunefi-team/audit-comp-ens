/**
 * Pure async function to create a subname.
 *
 * Prepares the createSubnameV2 transaction, starts it through
 * the transaction manager, and waits for completion.
 */

import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import type { Address, Hex, WalletClient } from 'viem'
import type { ProtocolVersion } from '@/utils/types'
import { prepareCreateSubnameTransaction } from '../utils/create-subname.helpers'

export type CreateSubnameParameters = {
  /** The subregistry address (parent registry for the subname) */
  readonly registryAddress: Address
  /** The label of the subname to create */
  readonly label: string
  /** The owner address of the new subname */
  readonly owner: Address
  /** The resolver address for the new subname */
  readonly resolverAddress: Address
  /** The wallet client with account */
  readonly walletClient: WalletClient
  /** Signer for the transaction */
  readonly signer: Signer
  /** Chain ID */
  readonly chainId: number
  /** ENS protocol version (for query invalidation) */
  readonly protocolVersion: ProtocolVersion
  /** Parent name (for description) */
  readonly parentName: string
  /** Transaction ID for tracking */
  readonly id: string
  /** Optional expiry timestamp in seconds (unix). Defaults to 1 year via ensjs. */
  readonly expires?: bigint
}

export interface CreateSubnameResult {
  readonly txId: string
  readonly hash: Hex
}

export async function createSubname(
  params: CreateSubnameParameters,
): Promise<CreateSubnameResult> {
  const {
    registryAddress,
    label,
    owner,
    resolverAddress,
    walletClient,
    signer,
    chainId,
    parentName,
    id,
    expires,
  } = params

  const intent = prepareCreateSubnameTransaction({
    registryAddress,
    label,
    owner,
    resolverAddress,
    walletClient,
    chainId,
    expires,
  })

  const txId = transactionManager.startTransaction(intent, signer, {
    id,
    chainId,
    description: `Create subname ${label}.${parentName}`,
  })

  const result = await waitForTransaction(txId)

  return {
    txId,
    hash: result.hash,
  }
}
