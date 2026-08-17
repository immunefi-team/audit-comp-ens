import type { AtomicMigrationBatch } from './buildAtomicMigrationBatches'
import type {
  MigrationApproval,
  MigrationApprovalId,
} from './migrationApprovals'
import { requiresMigrationApprovalCleanup } from './migrationApprovals'

type RegistrationApprovalTarget = {
  readonly name: string
  readonly tokenId: bigint
}

export type MigrationStepDescriptor =
  | { readonly type: 'deploy-hca' }
  | {
      readonly type: 'approval'
      readonly approvalId: MigrationApprovalId
      readonly count?: number
      readonly name?: string
      readonly tokenId?: bigint
    }
  | {
      readonly type: 'atomic-batch'
      readonly index: number
      readonly total: number
      readonly count: number
    }
  | {
      readonly type: 'cleanup'
      readonly approvalId: MigrationApprovalId
    }

export type BuildStepDescriptorsParams = {
  readonly hcaDeploymentRequired: boolean
  readonly approvals: readonly MigrationApproval[]
  readonly atomicBatches: readonly AtomicMigrationBatch[]
  readonly registrationApprovalTargets: readonly RegistrationApprovalTarget[]
}

export const buildStepDescriptors = (
  params: BuildStepDescriptorsParams,
): MigrationStepDescriptor[] => {
  const descriptors: MigrationStepDescriptor[] = []
  const registrationNameByTokenId = new Map(
    params.registrationApprovalTargets.map(({ name, tokenId }) => [
      tokenId,
      name,
    ]),
  )

  if (params.hcaDeploymentRequired) {
    descriptors.push({ type: 'deploy-hca' })
  }

  for (const approval of params.approvals) {
    if (approval.kind === 'erc721-token') {
      descriptors.push({
        type: 'approval',
        approvalId: approval.id,
        name: registrationNameByTokenId.get(approval.tokenId),
        tokenId: approval.tokenId,
      })
      continue
    }

    descriptors.push({
      type: 'approval',
      approvalId: approval.id,
      count:
        approval.id === 'base-registrar:hca'
          ? params.registrationApprovalTargets.length
          : undefined,
    })
  }

  for (const [index, batch] of params.atomicBatches.entries()) {
    descriptors.push({
      type: 'atomic-batch',
      index,
      total: params.atomicBatches.length,
      count: batch.names.length,
    })
  }

  for (const approval of params.approvals) {
    if (!requiresMigrationApprovalCleanup(approval)) continue
    descriptors.push({ type: 'cleanup', approvalId: approval.id })
  }

  return descriptors
}
