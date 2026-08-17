/**
 * Pure async function to change the resolver for an ENS V2 name.
 *
 * Follows the same pattern as saveRecords and deploySubregistry/setSubregistry:
 * 1. Compute labelToCanonicalId from name label
 * 2. Encode setResolver call with ensjs ABI snippet
 * 3. Submit via transaction manager
 */

import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import { permissionedRegistrySetResolverSnippet } from '@ensdomains/ensjs/contracts'
import { labelToCanonicalId } from '@ensdomains/ensjs/utils/v2'
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

export interface ChangeResolverTransactionParameters {
  /** The ENS name (e.g., 'sub.parent.eth') */
  readonly name: string
  /** The registry address that manages this name (parent's registry) */
  readonly registryAddress: Address
  /** The new resolver address to set */
  readonly resolverAddress: Address
  /** The connected account that submits the transaction */
  readonly from: Address
  readonly chainId: number
}

// Same call inputs as the transaction builder, but `from` is derived from the
// wallet client at submit time rather than passed in.
export interface ChangeResolverParameters
  extends Omit<ChangeResolverTransactionParameters, 'from'> {
  readonly walletClient: WalletClient
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly id: string
}

export interface ChangeResolverResult {
  txId: string
  hash: Hex
}

// ============================================================================
// Transaction builder
// ============================================================================

/** The setResolver intent, shared by the gas estimate and `changeResolver`. */
export const prepareChangeResolverTransaction = ({
  name,
  registryAddress,
  resolverAddress,
  from,
  chainId,
}: ChangeResolverTransactionParameters): CustomTransactionIntent => {
  const label = name.split('.')[0]
  const anyId = labelToCanonicalId(label)

  const data = encodeFunctionData({
    abi: permissionedRegistrySetResolverSnippet,
    functionName: 'setResolver',
    args: [anyId, resolverAddress],
  })

  return toEoaCustomIntent({
    from,
    to: registryAddress,
    data,
    chainId,
  })
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Change the resolver for an ENS V2 name.
 *
 * @throws Error if wallet not connected or transaction fails
 *
 * @example
 * ```ts
 * const result = await changeResolver({
 *   name: 'myname.eth',
 *   registryAddress: parentRegistry,
 *   resolverAddress: newResolverAddress,
 *   walletClient,
 *   publicClient,
 *   signer,
 *   chainId: 11155111,
 * })
 * ```
 */
export const changeResolver = async ({
  name,
  registryAddress,
  resolverAddress,
  walletClient,
  publicClient,
  signer,
  chainId,
  id,
}: ChangeResolverParameters): Promise<ChangeResolverResult> => {
  if (!walletClient.account || !walletClient.chain) {
    throw new Error('Wallet client must have account and chain configured')
  }

  const txId = transactionManager.startTransaction(
    prepareChangeResolverTransaction({
      name,
      registryAddress,
      resolverAddress,
      from: walletClient.account.address,
      chainId,
    }),
    signer,
    {
      id,
      description: `Change resolver for ${name}`,
      publicClient,
      chainId,
    },
  )

  const result = await waitForTransaction(txId)

  return {
    txId,
    hash: result.hash,
  }
}
