import {
  buildHcaDeploymentCall,
  verifyStandaloneHca,
} from '@ens-apps/smart-account'
import {
  type Call,
  type Signer,
  type TransactionRequest,
  transactionManager,
  waitForTransaction,
  waitForTransactionHash,
} from '@ens-apps/transaction-manager'
import { TaggedError } from '@ens-apps/utils/neverthrow'
import type { RhinestoneAccount } from '@rhinestone/sdk'
import type { Config as WagmiConfig } from '@wagmi/core'
import {
  type Address,
  type Hex,
  isAddressEqual,
  type PublicClient,
  type TransactionReceipt,
} from 'viem'

import { BASE_REGISTRAR_ABI, NAME_WRAPPER_ABI } from '../contracts/abis'
import { V1_CONTRACTS, V2_CONTRACTS } from '../contracts/addresses'
import { EXECUTION_TARGET_GAS, TARGET_GAS } from './batchMigrate.constants'
import { buildAtomicMigrationBatches } from './buildAtomicMigrationBatches'
import { adjustPlanForRetry, type MigrationPlan } from './buildMigrationPlan'
import type { IneligibleName } from './classifyNames'
import { decodeMigrationError } from './decodeMigrationError'
import { resolveDirectMigrationRoutes } from './directMigrationRoutes'
import { approvalNeedsFor } from './migrationApprovalNeeds'
import {
  buildMigrationApprovalCall,
  buildMigrationOperatorApprovalRevocationCall,
  checkMigrationApprovals,
  type MigrationApproval,
  type MigrationCleanupApproval,
  migrationApprovalKey,
  planMigrationApprovals,
  requiresMigrationApprovalCleanup,
} from './migrationApprovals'
import {
  loadPendingAtomicMigrationIntents,
  loadSubmittedAtomicMigrationBatches,
  type MigrationBatchJournalScope,
  persistPendingAtomicMigrationIntent,
  persistSubmittedAtomicMigrationBatch,
  removePendingAtomicMigrationIntent,
  removeSubmittedAtomicMigrationBatch,
} from './migrationBatchJournal'
import { checkDeterministicMigrationResolverReadiness } from './migrationInvariants'
import {
  reconcileAtomicMigrationBatch,
  verifyAtomicMigrationBatch,
} from './verifyAtomicMigrationBatch'

export type { MigrationPlan } from './buildMigrationPlan'
export type { MigrationStepDescriptor } from './buildStepDescriptors'
export type { MigrationPreflight } from './computeMigrationPreflight'

class MigrationError extends TaggedError('MigrationError')<{
  cause: unknown
  step?: string
}> {}

class MigrationUserRejectedError extends TaggedError(
  'MigrationUserRejectedError',
)<{
  step: string
}> {}

export class MigrationPlanChangedError extends TaggedError(
  'MigrationPlanChangedError',
)<{
  readonly message: string
  readonly plannedApprovalKeys: readonly string[]
  readonly currentApprovalKeys: readonly string[]
}> {}

export class SubmittedAtomicMigrationIndeterminateError extends TaggedError(
  'SubmittedAtomicMigrationIndeterminateError',
)<{
  readonly message: string
  readonly hash: Hex
  readonly names: readonly string[]
  readonly cause?: unknown
}> {}

export class AtomicMigrationIntentIndeterminateError extends TaggedError(
  'AtomicMigrationIntentIndeterminateError',
)<{
  readonly message: string
  readonly intentId: string
  readonly names: readonly string[]
}> {}

export class SubmittedAtomicMigrationVerificationError extends TaggedError(
  'SubmittedAtomicMigrationVerificationError',
)<{
  readonly message: string
  readonly hash: Hex
  readonly names: readonly string[]
  readonly cause: unknown
}> {}

export class MigrationSourceOwnershipError extends TaggedError(
  'MigrationSourceOwnershipError',
)<{
  readonly message: string
  readonly names: readonly string[]
  readonly cause?: unknown
}> {}

export class MigrationCleanupError extends TaggedError(
  'MigrationCleanupError',
)<{
  readonly message: string
  readonly cause: unknown
}> {}

const isUserRejection = (error: unknown): boolean => {
  let current: unknown = error
  while (current instanceof Error) {
    if (current.name === 'UserRejectedRequestError') return true
    if (/user rejected/i.test(current.message)) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

export type MigrationProgress = {
  readonly currentStep: number
  readonly totalSteps: number
  readonly description: string
  readonly txHash?: Hex
}

export type MigrationResult = {
  readonly completed: number
  readonly txHashes: readonly Hex[]
  readonly ineligible: readonly IneligibleName[]
}

type Tracker = {
  emit: (description: string, txHash?: Hex) => void
  next: () => void
  complete: (description: string, txHash?: Hex) => void
}

const createTracker = (
  onProgress: (progress: MigrationProgress) => void,
  totalSteps: number,
): Tracker => {
  let currentStep = 0
  const normalizedTotal = Math.max(totalSteps, 1)
  const emit = (description: string, txHash?: Hex) => {
    onProgress({
      currentStep,
      totalSteps: normalizedTotal,
      description,
      txHash,
    })
  }
  return {
    emit,
    next() {
      currentStep = Math.min(currentStep + 1, normalizedTotal)
    },
    complete(description, txHash) {
      if (currentStep >= normalizedTotal) return
      currentStep = normalizedTotal
      emit(description, txHash)
    },
  }
}

type MigrationCtx = {
  readonly wagmiConfig: WagmiConfig
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly walletAddress: Address
  readonly hcaAddress: Address
  readonly tracker: Tracker
}

const batchJournalScope = (
  ctx: Pick<MigrationCtx, 'publicClient' | 'walletAddress' | 'hcaAddress'>,
): MigrationBatchJournalScope => {
  const chainId = ctx.publicClient.chain?.id
  if (!chainId) {
    throw new Error('publicClient is missing a chain configuration')
  }
  return {
    chainId,
    owner: ctx.walletAddress,
    hca: ctx.hcaAddress,
  }
}

const PENDING_TX_HASH = '0x0' as Hex
const RECEIPT_TIMEOUT_MS = 300_000
const APPROVAL_HEAD_LAG_RETRY_DELAYS_MS = [
  250, 500, 1_000, 2_000, 4_000,
] as const

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const buildEOARequest = (
  ctx: Pick<MigrationCtx, 'publicClient' | 'walletAddress'>,
  call: Call,
): TransactionRequest => {
  const chainId = ctx.publicClient.chain?.id
  if (!chainId) {
    throw new Error('publicClient is missing a chain configuration')
  }

  return {
    type: 'eoa',
    from: ctx.walletAddress,
    to: call.to,
    data: call.data,
    value: call.value,
    chainId,
  }
}

const wrapMigrationError = (
  error: unknown,
  step: string,
): MigrationUserRejectedError | MigrationError =>
  isUserRejection(error)
    ? new MigrationUserRejectedError({ step })
    : new MigrationError({ cause: error, step })

const submitCall = async (
  ctx: MigrationCtx,
  call: Call,
  description: string,
  onSubmitted?: (hash: Hex) => void,
): Promise<{ readonly hash: Hex; readonly receipt: TransactionReceipt }> => {
  const txId = transactionManager.startTransaction(
    { type: 'custom', request: buildEOARequest(ctx, call) },
    ctx.signer,
    {
      description,
      publicClient: ctx.publicClient,
    },
  )
  ctx.tracker.emit(description, PENDING_TX_HASH)
  const submittedHash = (await waitForTransactionHash(txId)) as Hex
  onSubmitted?.(submittedHash)
  const result = await waitForTransaction(txId)
  const hash = result.hash as Hex
  if (hash.toLowerCase() !== submittedHash.toLowerCase()) onSubmitted?.(hash)
  const receipt =
    result.receipt ??
    (await ctx.publicClient.waitForTransactionReceipt({
      hash,
      timeout: RECEIPT_TIMEOUT_MS,
    }))
  if (receipt.status !== 'success') {
    throw new Error(`${description} reverted (tx ${hash})`)
  }
  return { hash, receipt }
}

const hasCode = (code: Hex | undefined): boolean =>
  Boolean(code && code !== '0x')

const ensureHcaDeployment = async (params: {
  readonly ctx: MigrationCtx
  readonly hcaClient: Pick<RhinestoneAccount, 'getAddress' | 'getInitData'>
  readonly refreshAccount: () => Promise<void>
  readonly plannedDeployment: boolean
}): Promise<Hex | null> => {
  const { ctx, hcaClient, refreshAccount, plannedDeployment } = params
  const code = await ctx.publicClient.getCode({ address: ctx.hcaAddress })

  if (!hasCode(code)) {
    try {
      const { hash } = await submitCall(
        ctx,
        buildHcaDeploymentCall({
          client: hcaClient,
          chainId: ctx.publicClient.chain?.id ?? 11155111,
          expectedHca: ctx.hcaAddress,
          expectedOwner: ctx.walletAddress,
        }),
        'Setting up your HCA',
      )
      await verifyStandaloneHca({
        publicClient: ctx.publicClient,
        hca: ctx.hcaAddress,
        expectedOwner: ctx.walletAddress,
        chainId: ctx.publicClient.chain?.id ?? 11155111,
      })
      await refreshAccount()
      ctx.tracker.next()
      ctx.tracker.emit('HCA ready', hash)
      return hash
    } catch (error) {
      throw wrapMigrationError(error, 'Setting up HCA')
    }
  }

  await verifyStandaloneHca({
    publicClient: ctx.publicClient,
    hca: ctx.hcaAddress,
    expectedOwner: ctx.walletAddress,
    chainId: ctx.publicClient.chain?.id ?? 11155111,
  })
  // A retry can reuse an HCA deployed by the previous attempt. The preview
  // still contains the deployment descriptor, so consume that planned step
  // even though no second transaction is sent.
  if (plannedDeployment) {
    ctx.tracker.next()
    ctx.tracker.emit('HCA already ready')
  }
  return null
}

const approvalDescription = (approval: MigrationApproval): string => {
  if (approval.kind === 'erc721-token') {
    return 'Allowing the migration helper to migrate this registration'
  }
  switch (approval.id) {
    case 'base-registrar:hca':
      return 'Allowing the migration helper to migrate registrations'
    case 'name-wrapper:hca':
      return 'Allowing the migration helper to migrate wrapped names'
    case 'eth-registry:hca':
      return 'Allowing your HCA to restore managers'
  }
}

const getMissingMigrationApprovals = async (params: {
  readonly ctx: MigrationCtx
  readonly plan: MigrationPlan
}): Promise<readonly MigrationApproval[]> => {
  const { ctx, plan } = params
  const basicNeeds = approvalNeedsFor(plan.groups)
  const needs = {
    ...basicNeeds,
    requiresManagerRestoration: plan.classified.some(
      (name) => name.managerAddress !== null,
    ),
  }
  const status = await checkMigrationApprovals({
    eoa: ctx.walletAddress,
    hcaAddress: ctx.hcaAddress,
    needs,
    wagmiConfig: ctx.wagmiConfig,
  })
  return planMigrationApprovals({
    hcaAddress: ctx.hcaAddress,
    needs,
    status,
  })
}

const sortedApprovalKeys = (
  approvals: readonly MigrationApproval[],
): string[] => approvals.map(migrationApprovalKey).sort()

const assertMigrationApprovalPlanCurrent = async (params: {
  readonly ctx: MigrationCtx
  readonly plan: MigrationPlan
}): Promise<readonly MigrationApproval[]> => {
  const missing = await getMissingMigrationApprovals(params)
  const plannedApprovalKeys = sortedApprovalKeys(
    params.plan.preflight.migrationApprovals ?? [],
  )
  const currentApprovalKeys = sortedApprovalKeys(missing)
  const matches =
    plannedApprovalKeys.length === currentApprovalKeys.length &&
    plannedApprovalKeys.every(
      (approvalKey, index) => approvalKey === currentApprovalKeys[index],
    )

  if (!matches) {
    throw new MigrationPlanChangedError({
      message:
        'Migration permissions changed after the preview. Return to selection to review the updated confirmation estimate.',
      plannedApprovalKeys,
      currentApprovalKeys,
    })
  }
  return missing
}

const ensureMigrationApprovals = async (params: {
  readonly ctx: MigrationCtx
  readonly plan: MigrationPlan
  readonly currentMissing?: readonly MigrationApproval[]
}): Promise<readonly Hex[]> => {
  const { ctx, plan } = params
  const missing =
    params.currentMissing ?? (await getMissingMigrationApprovals({ ctx, plan }))

  const hashes: Hex[] = []
  const missingById = new Map(
    missing.map((approval) => [migrationApprovalKey(approval), approval]),
  )
  const plannedApprovals = plan.preflight.migrationApprovals ?? []
  const orderedApprovals = [
    ...plannedApprovals.map((approval) => ({
      approval,
      missing: missingById.get(migrationApprovalKey(approval)),
    })),
    ...missing
      .filter(
        (approval) =>
          !plannedApprovals.some(
            (planned) =>
              migrationApprovalKey(planned) === migrationApprovalKey(approval),
          ),
      )
      .map((approval) => ({ approval, missing: approval })),
  ]

  for (const { approval, missing: missingApproval } of orderedApprovals) {
    if (!missingApproval) {
      ctx.tracker.next()
      ctx.tracker.emit('Permission already confirmed')
      continue
    }
    const description = approvalDescription(approval)
    try {
      const { hash } = await submitCall(
        ctx,
        buildMigrationApprovalCall(approval),
        description,
      )
      hashes.push(hash)
      ctx.tracker.next()
      ctx.tracker.emit('Permission confirmed', hash)
    } catch (error) {
      throw wrapMigrationError(error, description)
    }
  }
  return hashes
}

const cleanupDescription = (_approval: MigrationCleanupApproval): string =>
  'Removing manager-restoration access from your HCA'

const revokeTemporaryOperatorApprovals = async (params: {
  readonly ctx: MigrationCtx
  readonly plan: MigrationPlan
}): Promise<readonly Hex[]> => {
  const temporaryOperators = (
    params.plan.preflight.migrationApprovals ?? []
  ).filter(requiresMigrationApprovalCleanup)
  const hashes: Hex[] = []

  for (const approval of temporaryOperators) {
    const description = cleanupDescription(approval)
    try {
      const { hash } = await submitCall(
        params.ctx,
        buildMigrationOperatorApprovalRevocationCall(approval),
        description,
      )
      hashes.push(hash)
      params.ctx.tracker.next()
      params.ctx.tracker.emit('Temporary access removed', hash)
    } catch (cause) {
      throw new MigrationCleanupError({
        message:
          'Your names were upgraded, but temporary migration access still needs to be revoked.',
        cause,
      })
    }
  }

  return hashes
}

const removeNames = <T extends { readonly domain: { readonly name: string } }>(
  names: readonly T[],
  completedNames: readonly string[],
): T[] => {
  const completed = new Set(completedNames)
  return names.filter((name) => !completed.has(name.domain.name))
}

type MigrationRetryReconciliation = {
  readonly completedNameGroups: readonly (readonly string[])[]
  readonly incompleteNames: readonly string[]
}

type RecoveredSubmittedBatch = {
  readonly names: readonly string[]
  readonly hash: Hex
}

type SubmittedBatchReconciliation = {
  readonly recovered: readonly RecoveredSubmittedBatch[]
  readonly unresolvedIntentIds: readonly string[]
  readonly unresolvedSubmissions: readonly (RecoveredSubmittedBatch & {
    readonly intentId: string
  })[]
}

type JournaledSubmission = ReturnType<
  typeof loadSubmittedAtomicMigrationBatches
>[number]

const nameExecutionsByName = (plan: MigrationPlan) =>
  new Map(
    plan.atomicBatches.flatMap((batch) =>
      batch.nameExecutions.map(
        (execution) => [execution.classified.domain.name, execution] as const,
      ),
    ),
  )

type AtomicNameExecution =
  ReturnType<typeof nameExecutionsByName> extends Map<string, infer T>
    ? T
    : never

const getSubmittedBatchReceipt = async (params: {
  readonly ctx: MigrationCtx
  readonly submission: RecoveredSubmittedBatch & { readonly intentId: string }
}): Promise<TransactionReceipt> => {
  try {
    return await params.ctx.publicClient.getTransactionReceipt({
      hash: params.submission.hash,
    })
  } catch (cause) {
    throw new SubmittedAtomicMigrationIndeterminateError({
      message: `Submitted atomic batch ${params.submission.hash} is still pending or its receipt is unavailable`,
      hash: params.submission.hash,
      names: params.submission.names,
      cause,
    })
  }
}

const reconcileSubmittedAtomicBatch = async (params: {
  readonly ctx: MigrationCtx
  readonly plan: MigrationPlan
  readonly scope: MigrationBatchJournalScope
  readonly submission: RecoveredSubmittedBatch & { readonly intentId: string }
  readonly expectedNames: ReadonlySet<string>
  readonly executions: ReadonlyMap<string, AtomicNameExecution>
}): Promise<RecoveredSubmittedBatch | null> => {
  const { submission } = params
  const missingNames = submission.names.filter(
    (name) => !params.expectedNames.has(name) || !params.executions.has(name),
  )
  if (missingNames.length > 0) {
    throw new SubmittedAtomicMigrationIndeterminateError({
      message: `Submitted atomic batch ${submission.hash} no longer matches the migration plan`,
      hash: submission.hash,
      names: submission.names,
    })
  }

  const receipt = await getSubmittedBatchReceipt({
    ctx: params.ctx,
    submission,
  })
  if (receipt.status === 'reverted') {
    await assertSourceTokensOwnedForRetry({
      publicClient: params.ctx.publicClient,
      plan: params.plan,
      names: submission.names,
    })
    removeSubmittedAtomicMigrationBatch(params.scope, submission.hash)
    removePendingAtomicMigrationIntent(params.scope, submission.intentId)
    return null
  }

  const verificationExpectations = submission.names.flatMap(
    (name) => params.executions.get(name)?.verificationExpectations ?? [],
  )
  try {
    await verifyAtomicMigrationBatch({
      publicClient: params.ctx.publicClient,
      batch: { index: 0, verificationExpectations },
      blockNumber: receipt.blockNumber,
    })
  } catch (cause) {
    // A successful receipt proves every inner call executed atomically. A
    // post-state mismatch is an invariant/verification incident, never a
    // signal to transfer the source token a second time.
    throw new SubmittedAtomicMigrationVerificationError({
      message: `Confirmed atomic batch ${submission.hash} could not be verified and will not be resubmitted`,
      hash: submission.hash,
      names: submission.names,
      cause,
    })
  }

  removeSubmittedAtomicMigrationBatch(params.scope, submission.hash)
  removePendingAtomicMigrationIntent(params.scope, submission.intentId)
  return submission
}

const unresolvedIntentIdsFor = (params: {
  readonly intents: ReturnType<typeof loadPendingAtomicMigrationIntents>
  readonly submissions: readonly JournaledSubmission[]
  readonly expectedNames: ReadonlySet<string>
  readonly allowStateFallback: boolean
}): readonly string[] => {
  const submittedIntentIds = new Set(
    params.submissions.map((submission) => submission.intentId),
  )
  const unresolvedIntentIds: string[] = []

  for (const intent of params.intents) {
    if (submittedIntentIds.has(intent.id)) continue
    if (!intent.names.some((name) => params.expectedNames.has(name))) continue
    if (!params.allowStateFallback) {
      throw new AtomicMigrationIntentIndeterminateError({
        message:
          'An atomic migration wallet prompt started but its transaction hash was not durably recorded. It will not be retried automatically.',
        intentId: intent.id,
        names: intent.names,
      })
    }
    unresolvedIntentIds.push(intent.id)
  }

  return unresolvedIntentIds
}

const reconcileJournaledSubmission = async (params: {
  readonly ctx: MigrationCtx
  readonly plan: MigrationPlan
  readonly scope: MigrationBatchJournalScope
  readonly submission: JournaledSubmission
  readonly expectedNames: ReadonlySet<string>
  readonly executions: ReadonlyMap<string, AtomicNameExecution>
  readonly allowStateFallback: boolean
}): Promise<RecoveredSubmittedBatch | 'unresolved' | null> => {
  if (!params.submission.names.some((name) => params.expectedNames.has(name))) {
    return null
  }
  try {
    return await reconcileSubmittedAtomicBatch(params)
  } catch (error) {
    if (
      params.allowStateFallback &&
      error instanceof SubmittedAtomicMigrationIndeterminateError
    ) {
      return 'unresolved'
    }
    throw error
  }
}

const reconcileSubmittedAtomicBatches = async (params: {
  readonly ctx: MigrationCtx
  readonly plan: MigrationPlan
  readonly allowStateFallback: boolean
}): Promise<SubmittedBatchReconciliation> => {
  const scope = batchJournalScope(params.ctx)
  const intents = loadPendingAtomicMigrationIntents(scope)
  const submissions = loadSubmittedAtomicMigrationBatches(scope)
  if (submissions.length === 0 && intents.length === 0) {
    return {
      recovered: [],
      unresolvedIntentIds: [],
      unresolvedSubmissions: [],
    }
  }

  const expectedNames = new Set(
    params.plan.classified.map(({ domain }) => domain.name),
  )
  const executions = nameExecutionsByName(params.plan)
  const recovered: RecoveredSubmittedBatch[] = []
  const unresolvedIntentIds = unresolvedIntentIdsFor({
    intents,
    submissions,
    expectedNames,
    allowStateFallback: params.allowStateFallback,
  })
  const unresolvedSubmissions: (RecoveredSubmittedBatch & {
    readonly intentId: string
  })[] = []

  for (const submission of submissions) {
    const result = await reconcileJournaledSubmission({
      ctx: params.ctx,
      plan: params.plan,
      scope,
      submission,
      expectedNames,
      executions,
      allowStateFallback: params.allowStateFallback,
    })
    if (result === 'unresolved') unresolvedSubmissions.push(submission)
    else if (result) recovered.push(result)
  }

  return { recovered, unresolvedIntentIds, unresolvedSubmissions }
}

const assertSourceTokensOwnedForRetry = async (params: {
  readonly publicClient: PublicClient
  readonly plan: MigrationPlan
  readonly names: readonly string[]
}): Promise<void> => {
  const requested = new Set(params.names)
  const noLongerOwned: string[] = []

  for (const classified of params.plan.classified) {
    const name = classified.domain.name
    if (!requested.has(name)) continue
    try {
      if (classified.tokenType === 'unwrapped') {
        const owner = await params.publicClient.readContract({
          address: V1_CONTRACTS.BaseRegistrar,
          abi: BASE_REGISTRAR_ABI,
          functionName: 'ownerOf',
          args: [BigInt(classified.domain.labelhash)],
        })
        if (!isAddressEqual(owner, params.plan.migrationOwner)) {
          noLongerOwned.push(name)
        }
        continue
      }

      const balance = await params.publicClient.readContract({
        address: V1_CONTRACTS.NameWrapper,
        abi: NAME_WRAPPER_ABI,
        functionName: 'balanceOf',
        args: [params.plan.migrationOwner, BigInt(classified.domain.id)],
      })
      if (balance < 1n) noLongerOwned.push(name)
    } catch (cause) {
      throw new MigrationSourceOwnershipError({
        message: `Could not prove that ${name} is still owned by the wallet before retry`,
        names: [name],
        cause,
      })
    }
  }

  if (noLongerOwned.length > 0) {
    throw new MigrationSourceOwnershipError({
      message: `Refusing to retry ${noLongerOwned.join(', ')} because the source token is no longer owned by the wallet`,
      names: noLongerOwned,
    })
  }
}

/**
 * Reconciles each name from the immutable preview plan before rebuilding any
 * live transaction. A read failure is deliberately allowed to escape so a
 * retry cannot turn uncertain chain state into a duplicate migration attempt.
 */
const reconcileMigrationRetry = async (params: {
  readonly publicClient: PublicClient
  readonly plan: MigrationPlan
}): Promise<MigrationRetryReconciliation> => {
  const expectedNames = new Set(
    params.plan.classified.map(({ domain }) => domain.name),
  )
  const plannedExecutions = params.plan.atomicBatches.flatMap((batch) =>
    batch.nameExecutions
      .filter(({ classified }) => expectedNames.has(classified.domain.name))
      .map((nameExecution) => ({ batch, nameExecution })),
  )
  const plannedNames = plannedExecutions.map(
    ({ nameExecution }) => nameExecution.classified.domain.name,
  )
  const uniquePlannedNames = new Set(plannedNames)
  const duplicateNames = [...uniquePlannedNames].filter(
    (name) => plannedNames.filter((candidate) => candidate === name).length > 1,
  )
  if (duplicateNames.length > 0) {
    throw new Error(
      `Retry reconciliation plan contains duplicate expectations for: ${duplicateNames.join(', ')}`,
    )
  }

  const missingNames = [...expectedNames].filter(
    (name) => !uniquePlannedNames.has(name),
  )
  if (missingNames.length > 0) {
    throw new Error(
      `Retry reconciliation plan is missing expectations for: ${missingNames.join(', ')}`,
    )
  }

  const namesWithoutExpectations = plannedExecutions
    .filter(
      ({ nameExecution }) =>
        nameExecution.verificationExpectations.length === 0,
    )
    .map(({ nameExecution }) => nameExecution.classified.domain.name)
  if (namesWithoutExpectations.length > 0) {
    throw new Error(
      `Retry reconciliation plan has no verification expectations for: ${namesWithoutExpectations.join(', ')}`,
    )
  }

  const reconciled = await Promise.all(
    plannedExecutions.map(async ({ batch, nameExecution }) => ({
      batchIndex: batch.index,
      name: nameExecution.classified.domain.name,
      reconciliation: await reconcileAtomicMigrationBatch({
        publicClient: params.publicClient,
        batch: {
          index: batch.index,
          verificationExpectations: nameExecution.verificationExpectations,
        },
      }),
    })),
  )
  const completedNameGroups = params.plan.atomicBatches
    .map((batch) =>
      reconciled
        .filter(
          ({ batchIndex, reconciliation }) =>
            batchIndex === batch.index && reconciliation.status === 'complete',
        )
        .map(({ name }) => name),
    )
    .filter((names) => names.length > 0)
  const incompleteNames = reconciled
    .filter(({ reconciliation }) => reconciliation.status === 'incomplete')
    .map(({ name }) => name)

  await assertSourceTokensOwnedForRetry({
    publicClient: params.publicClient,
    plan: params.plan,
    names: incompleteNames,
  })

  return { completedNameGroups, incompleteNames }
}

const MASKED_ERC1155_RECEIVER_ERROR =
  /ERC1155: transfer to non ERC1155Receiver implementer/i

/**
 * dRPC can mask an estimate-only receiver out-of-gas as a generic ERC1155
 * failure. Explicit calls at the execution and preview limits distinguish that
 * provider ceiling from a real contract failure before the batch is reduced.
 */
const recoverMaskedRpcEstimate = async (params: {
  readonly ctx: Pick<MigrationCtx, 'publicClient' | 'walletAddress'>
  readonly call: Call
  readonly error: ReturnType<typeof decodeMigrationError>
}): Promise<bigint | null> => {
  if (
    params.error.type !== 'generic' ||
    !MASKED_ERC1155_RECEIVER_ERROR.test(params.error.message)
  ) {
    return null
  }

  try {
    await params.ctx.publicClient.call({
      account: params.ctx.walletAddress,
      to: params.call.to,
      data: params.call.data,
      value: params.call.value,
      gas: EXECUTION_TARGET_GAS,
    })
    return EXECUTION_TARGET_GAS
  } catch {
    try {
      await params.ctx.publicClient.call({
        account: params.ctx.walletAddress,
        to: params.call.to,
        data: params.call.data,
        value: params.call.value,
        gas: TARGET_GAS,
      })
      return EXECUTION_TARGET_GAS + 1n
    } catch {
      return null
    }
  }
}

const buildNextAtomicBatch = async (params: {
  readonly ctx: MigrationCtx
  readonly plan: MigrationPlan
  readonly remaining: MigrationPlan['classified']
  readonly retryPermissionHeadLag: boolean
}) => {
  const { ctx, plan, remaining, retryPermissionHeadLag } = params
  const resolverReadiness = await checkDeterministicMigrationResolverReadiness({
    publicClient: ctx.publicClient,
    hca: ctx.hcaAddress,
    wallet: ctx.walletAddress,
  })
  const directRoutes = await resolveDirectMigrationRoutes({
    publicClient: ctx.publicClient,
    classified: remaining,
  })
  const remainingNames = new Set(remaining.map(({ domain }) => domain.name))
  const initialBatchSize =
    plan.atomicBatches
      .map((batch) =>
        batch.names.reduce(
          (count, name) => count + Number(remainingNames.has(name)),
          0,
        ),
      )
      .find((count) => count > 0) ?? 1
  const atomicPlan = await buildAtomicMigrationBatches({
    chainId: ctx.publicClient.chain?.id ?? 11155111,
    hca: ctx.hcaAddress,
    wallet: ctx.walletAddress,
    classified: remaining,
    directRoutes,
    profiles: plan.profiles,
    defaultResolver: V2_CONTRACTS.DefaultResolver,
    resolverDeployed: resolverReadiness.status === 'verified',
    walletCoAdminGranted:
      resolverReadiness.status === 'verified' &&
      resolverReadiness.walletHasWildcardRoles,
    maxOuterGas: EXECUTION_TARGET_GAS,
    firstBatchOnly: true,
    initialBatchSize,
    estimateOuterGas: async ({ call }) => {
      let retryIndex = 0
      while (true) {
        try {
          return await ctx.publicClient.estimateGas({
            account: ctx.walletAddress,
            to: call.to,
            data: call.data,
            value: call.value,
          })
        } catch (error) {
          const decodedError = decodeMigrationError(error)
          const retryDelay = APPROVAL_HEAD_LAG_RETRY_DELAYS_MS[retryIndex]
          if (
            retryPermissionHeadLag &&
            retryDelay !== undefined &&
            decodedError.type === 'permission-missing'
          ) {
            retryIndex += 1
            await delay(retryDelay)
            continue
          }

          const recoveredEstimate = await recoverMaskedRpcEstimate({
            ctx,
            call,
            error: decodedError,
          })
          if (recoveredEstimate !== null) return recoveredEstimate
          throw error
        }
      }
    },
  })
  const batch = atomicPlan.batches[0]
  if (!batch) throw new Error('Atomic migration did not produce a batch')
  return batch
}

export type OnBatchComplete = (names: readonly string[], txHash?: Hex) => void

let atomicMigrationIntentNonce = 0
const createAtomicMigrationIntentId = (): string => {
  atomicMigrationIntentNonce += 1
  return `${Date.now()}:${atomicMigrationIntentNonce}`
}

const prepareExecutionPlan = async (params: {
  readonly reconcileBeforeSubmit: boolean
  readonly publicClient: PublicClient
  readonly plan: MigrationPlan
  readonly ctx: MigrationCtx
  readonly onBatchComplete?: OnBatchComplete
}): Promise<MigrationPlan> => {
  try {
    const journalReconciliation = await reconcileSubmittedAtomicBatches({
      ctx: params.ctx,
      plan: params.plan,
      allowStateFallback: params.reconcileBeforeSubmit,
    })
    const recoveredSubmissions = journalReconciliation.recovered
    const recoveredNames = recoveredSubmissions.flatMap(({ names }) => names)
    let executionPlan = adjustPlanForRetry(params.plan, recoveredNames)

    for (const { names, hash } of recoveredSubmissions) {
      params.onBatchComplete?.(names, hash)
      params.ctx.tracker.next()
      params.ctx.tracker.emit(
        names.length === 1
          ? `Recovered verified migration for ${names[0]}`
          : `Recovered ${names.length} verified migrations`,
        hash,
      )
    }

    if (
      !params.reconcileBeforeSubmit ||
      executionPlan.classified.length === 0
    ) {
      return executionPlan
    }

    const reconciliation = await reconcileMigrationRetry({
      publicClient: params.publicClient,
      plan: executionPlan,
    })
    const incompleteNames = new Set(reconciliation.incompleteNames)
    const completedNames = executionPlan.classified
      .filter(({ domain }) => !incompleteNames.has(domain.name))
      .map(({ domain }) => domain.name)
    executionPlan = adjustPlanForRetry(executionPlan, completedNames)

    const scope = batchJournalScope(params.ctx)
    for (const intentId of journalReconciliation.unresolvedIntentIds) {
      removePendingAtomicMigrationIntent(scope, intentId)
    }
    for (const submission of journalReconciliation.unresolvedSubmissions) {
      removeSubmittedAtomicMigrationBatch(scope, submission.hash)
      removePendingAtomicMigrationIntent(scope, submission.intentId)
    }

    for (const names of reconciliation.completedNameGroups) {
      params.onBatchComplete?.(names)
      params.ctx.tracker.next()
      params.ctx.tracker.emit(
        names.length === 1
          ? `Recovered verified migration for ${names[0]}`
          : `Recovered ${names.length} verified migrations`,
      )
    }

    return executionPlan
  } catch (error) {
    throw wrapMigrationError(error, 'Reconciling previous atomic migration')
  }
}

const executeRemainingAtomicBatches = async (params: {
  readonly ctx: MigrationCtx
  readonly plan: MigrationPlan
  readonly publicClient: PublicClient
  readonly onBatchComplete?: OnBatchComplete
  readonly retryPermissionHeadLag: boolean
}): Promise<readonly Hex[]> => {
  const hashes: Hex[] = []
  let remaining = [...params.plan.classified]
  const journalScope = batchJournalScope(params.ctx)
  let retryPermissionHeadLag = params.retryPermissionHeadLag

  while (remaining.length > 0) {
    const batch = await buildNextAtomicBatch({
      ctx: params.ctx,
      plan: params.plan,
      remaining,
      retryPermissionHeadLag,
    })
    retryPermissionHeadLag = false
    const description =
      batch.names.length === 1
        ? `Atomically upgrading ${batch.names[0]}`
        : `Atomically upgrading ${batch.names.length} names`
    const intent = {
      id: createAtomicMigrationIntentId(),
      names: batch.names,
    }
    persistPendingAtomicMigrationIntent(journalScope, intent)
    let submittedHash: Hex | undefined

    try {
      const { hash, receipt } = await submitCall(
        params.ctx,
        batch.outerCall,
        description,
        (nextHash) => {
          const previousHash = submittedHash
          submittedHash = nextHash
          persistSubmittedAtomicMigrationBatch(journalScope, {
            intentId: intent.id,
            hash: nextHash,
            names: batch.names,
          })
          if (
            previousHash &&
            previousHash.toLowerCase() !== nextHash.toLowerCase()
          ) {
            removeSubmittedAtomicMigrationBatch(journalScope, previousHash)
          }
          removePendingAtomicMigrationIntent(journalScope, intent.id)
        },
      )
      await verifyAtomicMigrationBatch({
        publicClient: params.publicClient,
        batch,
        blockNumber: receipt.blockNumber,
      })
      removeSubmittedAtomicMigrationBatch(journalScope, hash)
      hashes.push(hash)
      params.onBatchComplete?.(batch.names, hash)
      remaining = removeNames(remaining, batch.names)
      params.ctx.tracker.next()
      params.ctx.tracker.emit('Atomic batch verified', hash)
    } catch (error) {
      if (!submittedHash && isUserRejection(error)) {
        removePendingAtomicMigrationIntent(journalScope, intent.id)
      }
      throw wrapMigrationError(error, description)
    }
  }

  return hashes
}

export const executeMigration = async (params: {
  readonly plan: MigrationPlan
  readonly wagmiConfig: WagmiConfig
  readonly publicClient: PublicClient
  readonly signer: Signer
  readonly hcaClient: Pick<RhinestoneAccount, 'getAddress' | 'getInitData'>
  readonly refreshAccount: () => Promise<void>
  readonly onProgress: (progress: MigrationProgress) => void
  readonly onBatchComplete?: OnBatchComplete
  /** Set on retry to reconcile a receipt whose post-state polling was uncertain. */
  readonly reconcileBeforeSubmit?: boolean
}): Promise<MigrationResult> => {
  const {
    plan,
    wagmiConfig,
    publicClient,
    signer,
    hcaClient,
    refreshAccount,
    onProgress,
    onBatchComplete,
  } = params
  const { classified, ineligible } = plan

  if (classified.length === 0 && !params.reconcileBeforeSubmit) {
    return {
      completed: 0,
      txHashes: [],
      ineligible: [...ineligible],
    }
  }

  const ctx: MigrationCtx = {
    wagmiConfig,
    publicClient,
    signer,
    walletAddress: plan.migrationOwner,
    hcaAddress: plan.hcaAddress,
    tracker: createTracker(onProgress, plan.stepDescriptors.length),
  }
  const txHashes: Hex[] = []

  const executionPlan = await prepareExecutionPlan({
    reconcileBeforeSubmit: params.reconcileBeforeSubmit ?? false,
    publicClient,
    plan,
    ctx,
    onBatchComplete,
  })

  if (executionPlan.classified.length > 0) {
    // Permission state is mutable outside this flow. Check the preview against
    // the latest chain state before opening the first wallet prompt, then use
    // the same snapshot for approval submission. Retries intentionally retain
    // their reconciliation behavior because a previous attempt may already
    // have submitted one of the planned grants.
    const currentMissing = params.reconcileBeforeSubmit
      ? undefined
      : await assertMigrationApprovalPlanCurrent({
          ctx,
          plan: executionPlan,
        })
    const deploymentHash = await ensureHcaDeployment({
      ctx,
      hcaClient,
      refreshAccount,
      plannedDeployment: executionPlan.hcaDeploymentRequired,
    })
    if (deploymentHash) txHashes.push(deploymentHash)

    const approvalHashes = await ensureMigrationApprovals({
      ctx,
      plan: executionPlan,
      currentMissing,
    })
    txHashes.push(...approvalHashes)

    txHashes.push(
      ...(await executeRemainingAtomicBatches({
        ctx,
        plan: executionPlan,
        publicClient,
        onBatchComplete,
        retryPermissionHeadLag: approvalHashes.length > 0,
      })),
    )
  }
  txHashes.push(
    ...(await revokeTemporaryOperatorApprovals({
      ctx,
      plan,
    })),
  )
  ctx.tracker.complete('Migration complete', txHashes.at(-1))

  return {
    completed: classified.length,
    txHashes,
    ineligible: [...ineligible],
  }
}
