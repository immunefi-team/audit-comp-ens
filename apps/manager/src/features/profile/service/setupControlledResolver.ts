import {
  type Call,
  getSmartAccountAddress,
  type RhinestoneSigner,
  type TransactionRequest,
  transactionManager,
  waitForTransaction,
} from '@ens-apps/transaction-manager'
import { parseInput } from '@ensdomains/ensjs/utils'
import type { Address, PublicClient } from 'viem'
import {
  buildDeployOwnedPermResCall,
  findExistingPermRes,
  simulateOwnedPermResAddress,
} from '@/features/migration/service/ensureOwnedPermRes'
import { buildSetResolverCall } from './changeResolver'
import {
  buildRecordsUpdateCalls,
  type ServiceRecordSnapshot,
} from './profileRecordTransactions'

export interface SetupControlledResolverParams {
  /** ENS name, with or without the `.eth` suffix */
  name: string
  signer: RhinestoneSigner
  ownerAddress: Address
  publicClient: PublicClient
  chainId: number
  /**
   * Record diff to write to the freshly-controlled resolver. A freshly
   * deployed/assigned resolver starts empty, so callers typically pass an
   * empty `before` and the desired final records as `after`. When both are
   * empty the record-write step is omitted (deploy + setResolver only).
   */
  before: ServiceRecordSnapshot
  after: ServiceRecordSnapshot
  /** Transaction-manager description. Defaults to a generic setup label. */
  description?: string
}

/**
 * Give the connected owner a resolver they control on a transferred `name`,
 * point the name at it, and optionally write records — one atomic
 * intent: deploy the owned resolver (skipped when it already exists),
 * `setResolver`, record write. The owned resolver's address is deterministic
 * (CREATE2 keyed off the owner's salt and the smart account as deployer), so
 * it's predicted up front and the later calls point at it before it's mined.
 *
 * Only supports `.eth` 2LDs — subnames live in a parent registry we can't
 * deploy or point at, so this throws for them before submitting anything.
 *
 * Resolves with the resolver address once the intent is confirmed.
 */
export async function setupControlledResolver({
  name,
  signer,
  ownerAddress,
  publicClient,
  chainId,
  before,
  after,
  description = `Set up resolver for ${name}`,
}: SetupControlledResolverParams): Promise<Address> {
  const fullName = name.endsWith('.eth') ? name : `${name}.eth`
  if (!parseInput(fullName).is2LD) {
    throw new Error(
      'This subname can’t be set up here yet. Please set it up in the ENS app first.',
    )
  }

  const smartAccount = getSmartAccountAddress(signer)

  const existing = await findExistingPermRes({
    eoa: ownerAddress,
    deployer: smartAccount,
    publicClient,
  })
  const resolver =
    existing ??
    (await simulateOwnedPermResAddress({
      eoa: ownerAddress,
      deployer: smartAccount,
      publicClient,
    }))

  const hasRecordsToWrite =
    before.texts.length > 0 ||
    before.coins.length > 0 ||
    Boolean(before.contentHash?.trim()) ||
    Boolean(before.abi?.trim()) ||
    after.texts.length > 0 ||
    after.coins.length > 0 ||
    Boolean(after.contentHash?.trim()) ||
    Boolean(after.abi?.trim())

  const recordCalls = hasRecordsToWrite
    ? (
        await buildRecordsUpdateCalls({
          name,
          before,
          after,
          publicClient,
          resolverAddress: resolver,
        })
      ).calls
    : []

  const calls: Call[] = [
    ...(existing ? [] : [buildDeployOwnedPermResCall(ownerAddress)]),
    buildSetResolverCall({ name, newResolver: resolver }),
    ...recordCalls,
  ]

  const request: TransactionRequest = {
    type: 'rhinestone-intent',
    from: smartAccount,
    chainId,
    // User-paid in USDC out of the HCA's own balance; this deployment offers
    // no gas sponsorship. See `signer.types.ts`.
    rhinestoneParams: { calls, feeAsset: 'USDC' },
  }

  const txId = transactionManager.startTransaction(
    { type: 'custom', request },
    signer,
    {
      description,
      publicClient,
      chainId,
      operation: 'setup-controlled-resolver',
      name,
    },
  )
  await waitForTransaction(txId)

  return resolver
}
