/**
 * Pure async function to set subregistry on the parent registry.
 *
 * Uses transactionManager.startTransaction for Step 2 of the deploy flow
 * (or the only step when using a custom subregistry address).
 */

import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import { setSubregistryWriteParameters } from '@ensdomains/ensjs/wallet'
import type { Address, Hex, PublicClient, WalletClient } from 'viem'
import { encodeFunctionData } from 'viem'
import { toEoaCustomIntent } from '@/features/transaction-manager/helpers/intents'
import type { WalletClientWithAccount } from '@/utils/types'

export interface SetSubregistryTransactionParameters {
  readonly label: string
  readonly parentRegistry: Address
  readonly subregistryAddress: Address
  readonly walletClient: WalletClient
  readonly chainId: number
}

export interface SetSubregistryParameters
  extends SetSubregistryTransactionParameters {
  readonly name: string
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly id: string
}

export interface SetSubregistryResult {
  readonly txId: string
  readonly hash: Hex
}

/**
 * The setSubregistry intent, shared by the gas estimate and {@link setSubregistry}.
 * Only usable for the custom (user-provided) subregistry branch: in the
 * deploy-then-set flow the target address is only known once the deploy mines.
 */
export function prepareSetSubregistryTransaction({
  label,
  parentRegistry,
  subregistryAddress,
  walletClient,
  chainId,
}: SetSubregistryTransactionParameters): CustomTransactionIntent {
  if (!walletClient.account) {
    throw new Error('Wallet client must have account configured')
  }

  const walletWithAccount = walletClient as WalletClientWithAccount

  const writeParams = setSubregistryWriteParameters(walletWithAccount, {
    registryAddress: parentRegistry,
    label,
    subregistryAddress,
  })

  const data = encodeFunctionData({
    abi: writeParams.abi,
    functionName: writeParams.functionName,
    args: writeParams.args,
  })

  return toEoaCustomIntent({
    from: walletWithAccount.account.address,
    to: writeParams.address,
    data,
    chainId,
    // Explicit cap: live estimation for this call is unreliable, so the intent
    // carries the gas limit the submit path uses (the estimator falls back to
    // it when eth_estimateGas reverts).
    gas: 500000n,
  })
}

export const setSubregistry = async ({
  name,
  label,
  parentRegistry,
  subregistryAddress,
  walletClient,
  publicClient,
  signer,
  chainId,
  id,
}: SetSubregistryParameters): Promise<SetSubregistryResult> => {
  const txId = transactionManager.startTransaction(
    prepareSetSubregistryTransaction({
      label,
      parentRegistry,
      subregistryAddress,
      walletClient,
      chainId,
    }),
    signer,
    {
      id,
      description: `Set subregistry for ${name}`,
      publicClient,
      timeout: 120_000,
    },
  )

  const result = await waitForTransaction(txId)

  return {
    txId,
    hash: result.hash,
  }
}
