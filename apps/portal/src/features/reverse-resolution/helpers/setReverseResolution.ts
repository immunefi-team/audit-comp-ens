/**
 * Pure async function to set reverse resolution (address → name) via transactionManager.
 *
 * Handles both L1 (setPrimaryName) and L2 (setName/setNameForAddr) flows.
 */

import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { encodeFunctionData } from 'viem'
import { toEoaCustomIntent } from '@/features/transaction-manager/helpers/intents'
import type { WalletClientWithAccount } from '@/utils/types'

interface WriteRequest {
  readonly address: `0x${string}`
  readonly abi: readonly unknown[]
  readonly functionName: string
  readonly args: readonly unknown[]
}

export interface PrepareSetReverseResolutionTransactionParameters {
  readonly request: WriteRequest
  readonly from: Address
  readonly chainId: number
}

export interface SetReverseResolutionParameters {
  readonly name: string
  readonly request: WriteRequest
  readonly walletClient: WalletClient
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly chainId: number
  readonly id: string
}

export interface SetReverseResolutionResult {
  readonly txId: string
  readonly hash: Hex
}

/** The set-reverse-resolution intent, shared by the gas estimate and {@link setReverseResolution}. */
export function prepareSetReverseResolutionTransaction({
  request,
  from,
  chainId,
}: PrepareSetReverseResolutionTransactionParameters): CustomTransactionIntent {
  const data = encodeFunctionData({
    abi: request.abi,
    functionName: request.functionName,
    args: request.args,
  })

  return toEoaCustomIntent({
    from,
    to: request.address,
    data,
    chainId,
  })
}

export const setReverseResolution = async ({
  name,
  request,
  walletClient,
  publicClient,
  signer,
  chainId,
  id,
}: SetReverseResolutionParameters): Promise<SetReverseResolutionResult> => {
  if (!walletClient.account) {
    throw new Error('Wallet client must have account configured')
  }

  const walletWithAccount = walletClient as WalletClientWithAccount

  const intent = prepareSetReverseResolutionTransaction({
    request,
    from: walletWithAccount.account.address,
    chainId,
  })

  const txId = transactionManager.startTransaction(intent, signer, {
    id,
    description: `Set reverse resolution to ${name}`,
    publicClient,
    chainId,
  })

  const result = await waitForTransaction(txId)

  return {
    txId,
    hash: result.hash,
  }
}
