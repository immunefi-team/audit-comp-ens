import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import type { AtomicMigrationBatch } from './buildAtomicMigrationBatches'
import { buildStepDescriptors } from './buildStepDescriptors'
import type {
  MigrationApproval,
  MigrationOperatorApprovalId,
} from './migrationApprovals'

const CONTRACT = '0x0000000000000000000000000000000000000001' as Address
const HCA = '0x0000000000000000000000000000000000000002' as Address

const operatorApproval = (
  id: MigrationOperatorApprovalId,
): MigrationApproval => ({
  kind: 'operator',
  id,
  contractAddress: CONTRACT,
  operatorAddress: HCA,
})

const tokenApproval = (tokenId = 1n): MigrationApproval => ({
  kind: 'erc721-token',
  id: 'base-registrar:hca-token',
  contractAddress: CONTRACT,
  operatorAddress: HCA,
  tokenId,
})

const batches = (
  ...namesByBatch: readonly (readonly string[])[]
): readonly AtomicMigrationBatch[] =>
  namesByBatch.map((names) => ({ names }) as AtomicMigrationBatch)

const registrationApprovalTargets = (
  ...targets: readonly (readonly [tokenId: bigint, name: string])[]
) => targets.map(([tokenId, name]) => ({ name, tokenId }))

describe('buildStepDescriptors', () => {
  it('uses three successful-path steps for one unwrapped name and a fresh HCA', () => {
    expect(
      buildStepDescriptors({
        hcaDeploymentRequired: true,
        approvals: [tokenApproval()],
        atomicBatches: batches(['alice.eth']),
        registrationApprovalTargets: registrationApprovalTargets([
          1n,
          'alice.eth',
        ]),
      }),
    ).toEqual([
      { type: 'deploy-hca' },
      {
        type: 'approval',
        approvalId: 'base-registrar:hca-token',
        name: 'alice.eth',
        tokenId: 1n,
      },
      { type: 'atomic-batch', index: 0, total: 1, count: 1 },
    ])
  })

  it('uses two successful-path steps for one unwrapped name and an existing HCA', () => {
    expect(
      buildStepDescriptors({
        hcaDeploymentRequired: false,
        approvals: [tokenApproval()],
        atomicBatches: batches(['alice.eth']),
        registrationApprovalTargets: registrationApprovalTargets([
          1n,
          'alice.eth',
        ]),
      }),
    ).toHaveLength(2)
  })

  it('keeps the reusable helper approval for a wrapped selection', () => {
    expect(
      buildStepDescriptors({
        hcaDeploymentRequired: false,
        approvals: [operatorApproval('name-wrapper:hca')],
        atomicBatches: batches(['alice.eth', 'bob.eth']),
        registrationApprovalTargets: [],
      }),
    ).toEqual([
      { type: 'approval', approvalId: 'name-wrapper:hca', count: undefined },
      { type: 'atomic-batch', index: 0, total: 1, count: 2 },
    ])
  })

  it('uses one step when the HCA and required permissions already exist', () => {
    expect(
      buildStepDescriptors({
        hcaDeploymentRequired: false,
        approvals: [],
        atomicBatches: batches(['alice.eth']),
        registrationApprovalTargets: [],
      }),
    ).toEqual([{ type: 'atomic-batch', index: 0, total: 1, count: 1 }])
  })

  it('adds and removes a temporary manager approval around the migration batch', () => {
    expect(
      buildStepDescriptors({
        hcaDeploymentRequired: false,
        approvals: [operatorApproval('eth-registry:hca')],
        atomicBatches: batches(['alice.eth']),
        registrationApprovalTargets: [],
      }),
    ).toEqual([
      { type: 'approval', approvalId: 'eth-registry:hca', count: undefined },
      { type: 'atomic-batch', index: 0, total: 1, count: 1 },
      { type: 'cleanup', approvalId: 'eth-registry:hca' },
    ])
  })

  it('adds one atomic step for every extra gas batch', () => {
    expect(
      buildStepDescriptors({
        hcaDeploymentRequired: false,
        approvals: [],
        atomicBatches: batches(['alice.eth'], ['bob.eth']),
        registrationApprovalTargets: [],
      }),
    ).toEqual([
      { type: 'atomic-batch', index: 0, total: 2, count: 1 },
      { type: 'atomic-batch', index: 1, total: 2, count: 1 },
    ])
  })

  it('returns no descriptors when there is no work', () => {
    expect(
      buildStepDescriptors({
        hcaDeploymentRequired: false,
        approvals: [],
        atomicBatches: [],
        registrationApprovalTargets: [],
      }),
    ).toEqual([])
  })

  it('labels repeated token approvals with their registration names', () => {
    expect(
      buildStepDescriptors({
        hcaDeploymentRequired: false,
        approvals: [tokenApproval(1n), tokenApproval(2n)],
        atomicBatches: batches(['alice.eth', 'bob.eth']),
        registrationApprovalTargets: registrationApprovalTargets(
          [1n, 'alice.eth'],
          [2n, 'bob.eth'],
        ),
      }),
    ).toEqual([
      {
        type: 'approval',
        approvalId: 'base-registrar:hca-token',
        name: 'alice.eth',
        tokenId: 1n,
      },
      {
        type: 'approval',
        approvalId: 'base-registrar:hca-token',
        name: 'bob.eth',
        tokenId: 2n,
      },
      { type: 'atomic-batch', index: 0, total: 1, count: 2 },
    ])
  })
})
