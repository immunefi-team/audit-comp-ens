/**
 * Pure async function to burn fuses on an ENS name.
 *
 * Uses ensjs's setFusesWriteParameters which allows the owner
 * to burn their own child/owner fuses (CANNOT_UNWRAP, CANNOT_TRANSFER, etc.)
 */

import type { CustomTransactionIntent } from '@ens-apps/transaction-manager'
import { type Signer, transactionManager } from '@ens-apps/transaction-manager'
import type { ChildFuseKeys } from '@ensdomains/ensjs/utils'
import { setFusesWriteParameters } from '@ensdomains/ensjs/wallet'
import {
  type Address,
  encodeFunctionData,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { toEoaCustomIntent } from '@/features/transaction-manager/helpers/intents'
import { sepoliaWithEns } from '@/lib/wagmi'

// ============================================================================
// Types
// ============================================================================

type ChildFuseKey = (typeof ChildFuseKeys)[number]

export type BurnFusesTransactionParameters = {
  readonly name: string
  readonly fuses: ChildFuseKey[]
  readonly walletClient: WalletClient
  readonly chainId: number
}

export type BurnFusesParameters = BurnFusesTransactionParameters & {
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly id: string
}

export interface BurnFusesResult {
  txId: string
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Burn fuses on an ENS name.
 *
 * Uses ensjs's setFusesWriteParameters to burn child fuses on a wrapped name.
 * The caller must be the owner of the name.
 *
 * Fuse burning rules:
 * - To burn owner-controlled fuses (CANNOT_TRANSFER, etc.), CANNOT_UNWRAP must be burned first
 * - To burn CANNOT_UNWRAP, PARENT_CANNOT_CONTROL (PCC) must be burned first
 * - For .eth 2LDs, PCC and IS_DOT_ETH are automatically burned when wrapped
 *
 * @throws Error if no fuses to burn, wallet not connected, or transaction fails
 *
 * @example
 * ```ts
 * const mutation = useMutation({
 *   mutationFn: burnFuses,
 *   onSuccess: () => refetchWrapperData(),
 * })
 *
 * mutation.mutate({
 *   name: 'myname.eth',
 *   fuses: ['CANNOT_UNWRAP', 'CANNOT_TRANSFER'],
 *   walletClient,
 *   publicClient,
 *   signer,
 *   chainId: 11155111,
 * })
 * ```
 */
/** The burn-fuses intent, shared by the gas estimate and {@link burnFuses}. */
export function prepareBurnFusesTransaction({
  name,
  fuses,
  walletClient,
  chainId,
}: BurnFusesTransactionParameters): CustomTransactionIntent {
  if (!walletClient.account || !walletClient.chain) {
    throw new Error('Wallet client must have account and chain configured')
  }

  if (fuses.length === 0) {
    throw new Error('No fuses selected to burn')
  }

  // Type assertion is safe since we validated account and chain above.
  // Using `as unknown as` because ensjs requires a specific chain type with the
  // ensNameWrapper contract.
  const client = {
    ...walletClient,
    chain: sepoliaWithEns,
  } as unknown as Parameters<typeof setFusesWriteParameters>[0]

  const writeParams = setFusesWriteParameters(client, {
    name,
    fuses: { named: fuses },
  })

  const data = encodeFunctionData({
    abi: writeParams.abi,
    functionName: writeParams.functionName,
    args: writeParams.args,
  })

  return toEoaCustomIntent({
    from: walletClient.account.address,
    to: writeParams.address as Address,
    data,
    chainId,
  })
}

export async function burnFuses({
  name,
  fuses,
  walletClient,
  publicClient,
  signer,
  chainId,
  id,
}: BurnFusesParameters): Promise<{ txId: string }> {
  const intent = prepareBurnFusesTransaction({
    name,
    fuses,
    walletClient,
    chainId,
  })

  // Does NOT wait for completion - caller should track state via useTransaction(txId)
  const txId = transactionManager.startTransaction(intent, signer, {
    id,
    description: `Burn fuses for ${name}`,
    publicClient,
    chainId,
  })

  return { txId }
}
