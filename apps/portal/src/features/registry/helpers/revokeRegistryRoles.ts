/**
 * Pure async function to revoke registry-wide (ROOT_RESOURCE) roles on an
 * ENS V2 registry. Mirrors `grantRegistryRoles.ts` but uses
 * `revokeRolesWriteParameters` and `resource` stays hard-coded to
 * ROOT_RESOURCE so the revoke applies registry-wide rather than per-label.
 */

import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import {
  type Signer,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import type { Role } from '@ensdomains/ensjs/utils/v2'
import { revokeRolesWriteParameters } from '@ensdomains/ensjs/wallet/v2'
import {
  type Address,
  encodeFunctionData,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { toEoaCustomIntent } from '@/features/transaction-manager/helpers/intents'

export type RevokeRegistryRolesTransactionParameters = {
  readonly registryAddress: Address
  readonly account: Address
  readonly roles: readonly Role[]
  readonly walletClient: WalletClient
  readonly chainId: number
}

export type RevokeRegistryRolesParameters =
  RevokeRegistryRolesTransactionParameters & {
    readonly publicClient: PublicClient
    readonly signer: Signer
    readonly id: string
  }

export interface RevokeRegistryRolesResult {
  txId: string
  hash: Hex
}

// See `grantRegistryRoles.ts` — registry-wide scope.
const ROOT_RESOURCE = 0n

/** The revoke-roles intent, shared by the gas estimate and {@link revokeRegistryRoles}. */
export function prepareRevokeRegistryRolesTransaction({
  registryAddress,
  account,
  roles,
  walletClient,
  chainId,
}: RevokeRegistryRolesTransactionParameters): CustomTransactionIntent {
  if (!walletClient.account || !walletClient.chain) {
    throw new Error('Wallet client must have account and chain configured')
  }
  if (roles.length === 0) {
    throw new Error('No roles found to revoke')
  }

  const writeParams = revokeRolesWriteParameters(
    walletClient as Parameters<typeof revokeRolesWriteParameters>[0],
    {
      registryAddress,
      account,
      resource: ROOT_RESOURCE,
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

export async function revokeRegistryRoles(
  params: RevokeRegistryRolesParameters,
): Promise<RevokeRegistryRolesResult> {
  const {
    registryAddress,
    account,
    roles,
    walletClient,
    publicClient,
    signer,
    chainId,
    id,
  } = params

  const txId = transactionManager.startTransaction(
    prepareRevokeRegistryRolesTransaction({
      registryAddress,
      account,
      roles,
      walletClient,
      chainId,
    }),
    signer,
    {
      id,
      description: `Revoke registry roles for ${registryAddress}`,
      publicClient,
      chainId,
    },
  )

  const result = await waitForTransaction(txId)
  return { txId, hash: result.hash }
}
