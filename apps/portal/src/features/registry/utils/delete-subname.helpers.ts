/**
 * Delete Subname Helpers
 *
 * Pure functions for preparing deleteSubname transactions.
 */

import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import { deleteSubnameWriteParameters } from '@ensdomains/ensjs/wallet/v2'
import type { Address, WalletClient } from 'viem'
import { encodeFunctionData } from 'viem'
import { toEoaCustomIntent } from '@/features/transaction-manager/helpers/intents'

export interface PrepareDeleteSubnameParams {
  /** The parent registry (subregistry) address that manages this subname */
  readonly registryAddress: Address
  /** The label of the subname to delete (e.g. "sub" for sub.example.eth) */
  readonly label: string
  /** The wallet client with account */
  readonly walletClient: WalletClient
  /** Chain ID */
  readonly chainId: number
}

/** The deleteSubname intent, shared by the gas estimate and {@link deleteSubname}. */
export function prepareDeleteSubnameTransaction({
  registryAddress,
  label,
  walletClient,
  chainId,
}: PrepareDeleteSubnameParams): CustomTransactionIntent {
  if (!walletClient.account || !walletClient.chain) {
    throw new Error('Wallet client must have account and chain configured')
  }

  const writeParams = deleteSubnameWriteParameters(
    walletClient as Parameters<typeof deleteSubnameWriteParameters>[0],
    {
      registryAddress,
      label,
    },
  )

  const data = encodeFunctionData({
    abi: writeParams.abi,
    functionName: writeParams.functionName,
    args: writeParams.args,
  } as Parameters<typeof encodeFunctionData>[0])

  return toEoaCustomIntent({
    from: walletClient.account.address,
    to: writeParams.address,
    data,
    chainId,
  })
}
