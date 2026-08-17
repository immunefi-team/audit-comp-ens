/**
 * Transfer ownership of a v2 name.
 *
 * In ENS v2 a name is an ERC-1155 token held in its leaf `PermissionedRegistry`
 * (`getState(tokenId).latestOwner` is the owner). There is no dedicated
 * "transfer name" contract call — ownership moves via the standard ERC-1155
 * `safeTransferFrom`. The token id is the *versioned* id from `getTokenId(label)`.
 *
 * Note: the registry gates transfers on a transfer role/observer, so the sender
 * must hold the token and be allowed to move it.
 */

import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import {
  type Address,
  encodeFunctionData,
  erc1155Abi,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem'
import type { WalletClientWithAccount } from '@/utils/types'

export interface TransferTokenParameters {
  readonly name: string
  /** The registry the name's token lives in (the leaf subregistry). */
  readonly registryAddress: Address
  readonly tokenId: bigint
  readonly recipient: Address
  readonly walletClient: WalletClient
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly chainId: number
  readonly id: string
}

export interface TransferTokenResult {
  readonly txId: string
  readonly hash: Hex
}

export const transferToken = async ({
  name,
  registryAddress,
  tokenId,
  recipient,
  walletClient,
  publicClient,
  signer,
  chainId,
  id,
}: TransferTokenParameters): Promise<TransferTokenResult> => {
  if (!walletClient.account) {
    throw new Error('Wallet client must have account configured')
  }

  const walletWithAccount = walletClient as WalletClientWithAccount

  // ENS v2 names are ERC-1155 tokens held in their leaf `PermissionedRegistry`,
  // so ownership moves via the standard `safeTransferFrom` on that registry —
  // there is no dedicated transfer entrypoint. Amount is always 1 (names are
  // non-fungible) and no callback data is passed.
  const data = encodeFunctionData({
    abi: erc1155Abi,
    functionName: 'safeTransferFrom',
    args: [walletWithAccount.account.address, recipient, tokenId, 1n, '0x'],
  })

  const txId = transactionManager.startTransaction(
    {
      type: 'custom',
      request: {
        type: 'eoa',
        from: walletWithAccount.account.address,
        to: registryAddress,
        data,
        value: 0n,
        chainId,
      },
    },
    signer,
    {
      id,
      description: `Transfer ${name}`,
      publicClient,
      chainId,
    },
  )

  const result = await waitForTransaction(txId)

  return { txId, hash: result.hash }
}
