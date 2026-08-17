/**
 * Detach a v2 name from its subregistry (`parent.setSubregistry(label, 0x0)`).
 *
 * Used during a transfer to hand the recipient a clean name: afterwards the name
 * has no subregistry, so its existing subnames stop resolving and the recipient
 * can deploy their own. It never touches the subregistry itself, which may be
 * shared by the sender's other names — it only clears the parent's pointer.
 *
 * This is a registry write, so the registry gates it on the owner holding
 * `ROLE_SET_SUBREGISTRY` for the token; a normally-registered owner auto-holds
 * it, but a migrated/locked name never receives it (its subregistry is the
 * emancipated-subnames wrapper). Callers must confirm the role first (see
 * `useTransferDetachTargets`) — this step runs before the irreversible token
 * transfer, so a revert here leaves the name degraded.
 */

import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import { setSubregistryWriteParameters } from '@ensdomains/ensjs/wallet'
import {
  type Address,
  encodeFunctionData,
  type Hex,
  type PublicClient,
  type WalletClient,
  zeroAddress,
} from 'viem'
import type { WalletClientWithAccount } from '@/utils/types'

export interface DetachNameRegistryParameters {
  readonly name: string
  readonly label: string
  /** The parent registry that holds the name's token. */
  readonly registryAddress: Address
  readonly walletClient: WalletClient
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly chainId: number
  readonly id: string
}

export interface DetachNameRegistryResult {
  readonly txId: string
  readonly hash: Hex
}

export const detachNameRegistry = async ({
  name,
  label,
  registryAddress,
  walletClient,
  publicClient,
  signer,
  chainId,
  id,
}: DetachNameRegistryParameters): Promise<DetachNameRegistryResult> => {
  if (!walletClient.account) {
    throw new Error('Wallet client must have account configured')
  }

  const walletWithAccount = walletClient as WalletClientWithAccount

  const writeParams = setSubregistryWriteParameters(walletWithAccount, {
    registryAddress,
    label,
    subregistryAddress: zeroAddress,
  })

  const data = encodeFunctionData({
    abi: writeParams.abi,
    functionName: writeParams.functionName,
    args: writeParams.args,
  })

  const txId = transactionManager.startTransaction(
    {
      type: 'custom',
      request: {
        type: 'eoa',
        from: walletWithAccount.account.address,
        to: writeParams.address,
        data,
        chainId,
      },
    },
    signer,
    {
      id,
      description: `Detach registry for ${name}`,
      publicClient,
      timeout: 120_000,
    },
  )

  const result = await waitForTransaction(txId)

  return { txId, hash: result.hash }
}
