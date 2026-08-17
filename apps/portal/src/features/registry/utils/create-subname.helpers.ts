/**
 * Create Subname Helpers
 *
 * Pure functions for preparing createSubname transactions.
 */

import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import { createSubnameV2WriteParameters } from '@ensdomains/ensjs/wallet'
import type { Address, WalletClient } from 'viem'
import { encodeFunctionData, zeroAddress } from 'viem'
import { toEoaCustomIntent } from '@/features/transaction-manager/helpers/intents'

/**
 * Default role bitmap granted to the subname owner on creation.
 *
 * Each role occupies one nibble in the EnhancedAccessControl bitmap, so a value
 * of all `1`s grants every role to the owner. This ensures freshly created
 * subnames have all roles enabled by default, rather than being created with no
 * roles attached (an empty `0n` bitmap).
 *
 * ensjs uses the same `0x1111…` value internally for `deploySubregistry` and
 * `deployVerifiableProxy`, but keeps it as a module-private const (it is not
 * exported from `@ensdomains/ensjs`), so we redeclare the literal here.
 */
export const DEFAULT_ROLE_BITMAP = BigInt(
  '0x1111111111111111111111111111111111111111111111111111111111111111',
)

export interface PrepareCreateSubnameParams {
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
  /** Chain ID */
  readonly chainId: number
  /** Optional: subregistry address for the new subname (defaults to zeroAddress) */
  readonly subregistryAddress?: Address
  /** Optional: role bitmap to grant to the owner (defaults to all roles) */
  readonly roleBitmap?: bigint
  /** Optional: expiration timestamp in seconds */
  readonly expires?: bigint
}

/**
 * The createSubnameV2 intent, shared by the gas estimate and {@link createSubname}.
 *
 * NOTE: `createSubnameV2WriteParameters` defaults a missing `expires` to
 * `Date.now() + 1 year` at encode time, so a caller that wants the estimate to
 * stay byte-identical to the submitted call MUST pass a concrete, frozen
 * `expires` and reuse that same value in the actual `createSubname` call.
 */
export function prepareCreateSubnameTransaction({
  registryAddress,
  label,
  owner,
  resolverAddress,
  walletClient,
  chainId,
  subregistryAddress = zeroAddress,
  roleBitmap = DEFAULT_ROLE_BITMAP,
  expires,
}: PrepareCreateSubnameParams): CustomTransactionIntent {
  if (!walletClient.account || !walletClient.chain) {
    throw new Error('Wallet client must have account and chain configured')
  }

  const writeParams = createSubnameV2WriteParameters(
    walletClient as Parameters<typeof createSubnameV2WriteParameters>[0],
    {
      registryAddress,
      label,
      owner,
      subregistryAddress,
      resolverAddress,
      roleBitmap,
      expires,
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
