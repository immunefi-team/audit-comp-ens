/**
 * Pure async function to set forward resolution (name → address) via transactionManager.
 *
 * This makes a name the "primary name" by establishing the forward match
 * (setting the ETH address record on the resolver to point back to the address).
 */

import type { SetForwardResolutionRequest } from '@ens-apps/l2-primary/utils'
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

export interface PrepareSetForwardResolutionTransactionParameters {
  readonly request: SetForwardResolutionRequest
  readonly from: Address
  readonly chainId: number
}

export interface SetForwardResolutionParameters {
  readonly name: string
  readonly request: SetForwardResolutionRequest
  readonly walletClient: WalletClient
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly chainId: number
  readonly id: string
  readonly description?: string
}

export interface SetForwardResolutionResult {
  readonly txId: string
  readonly hash: Hex
}

/** The set-forward-resolution intent, shared by the gas estimate and {@link setForwardResolution}. */
export function prepareSetForwardResolutionTransaction({
  request,
  from,
  chainId,
}: PrepareSetForwardResolutionTransactionParameters): CustomTransactionIntent {
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

export const setForwardResolution = async ({
  name,
  request,
  walletClient,
  publicClient,
  signer,
  chainId,
  id,
  description,
}: SetForwardResolutionParameters): Promise<SetForwardResolutionResult> => {
  if (!walletClient.account) {
    throw new Error('Wallet client must have account configured')
  }

  const walletWithAccount = walletClient as WalletClientWithAccount

  const intent = prepareSetForwardResolutionTransaction({
    request,
    from: walletWithAccount.account.address,
    chainId,
  })

  const txId = transactionManager.startTransaction(intent, signer, {
    id,
    description: description ?? `Set primary name for ${name}`,
    publicClient,
    chainId,
  })

  const result = await waitForTransaction(txId)

  return {
    txId,
    hash: result.hash,
  }
}
