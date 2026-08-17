import type { Address, PublicClient } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { AtomicMigrationBatch } from './buildAtomicMigrationBatches'
import type { MigrationPlan } from './buildMigrationPlan'
import { estimateMigrationGasCost } from './estimateMigrationGasCost'
import type {
  MigrationApproval,
  MigrationOperatorApprovalId,
} from './migrationApprovals'

const account = '0x0000000000000000000000000000000000000001' as Address
const contract = '0x0000000000000000000000000000000000000002' as Address

const makeOperatorApproval = (
  id: MigrationOperatorApprovalId,
): MigrationApproval => ({
  kind: 'operator',
  id,
  contractAddress: contract,
  operatorAddress: account,
})

const makeTokenApproval = (tokenId = 1n): MigrationApproval => ({
  kind: 'erc721-token',
  id: 'base-registrar:hca-token',
  contractAddress: contract,
  operatorAddress: account,
  tokenId,
})

const makeAtomicBatch = (estimatedGas: bigint): AtomicMigrationBatch =>
  ({ estimatedGas }) as AtomicMigrationBatch

const makePlan = (overrides: Partial<MigrationPlan> = {}): MigrationPlan =>
  ({
    hcaAddress: contract,
    hcaDeploymentRequired: false,
    migrationOwner: account,
    domains: [],
    classified: [],
    ineligible: [],
    groups: {
      unwrapped: [],
      unlocked: [],
      locked2ld: [],
      childNames: new Map(),
    },
    preflight: {
      preExistingOwnedPermRes: null,
      skipApprovalPhase: true,
      skipFetchProfilesPhase: true,
      baseRegistrarApproved: true,
      nameWrapperApproved: true,
      migrationApprovals: [],
    },
    ownedPermRes: null,
    profiles: new Map(),
    atomicBatches: [],
    stepDescriptors: [],
    ...overrides,
  }) as MigrationPlan

const makePublicClient = (fee: {
  readonly maxFeePerGas?: bigint
  readonly gasPrice?: bigint
}): PublicClient =>
  ({
    estimateGas: vi.fn(),
    estimateFeesPerGas: vi.fn().mockResolvedValue(fee),
    getGasPrice: vi.fn().mockResolvedValue(9n),
  }) as unknown as PublicClient

describe('estimateMigrationGasCost', () => {
  it('counts three confirmations for a fresh HCA and one unwrapped name', async () => {
    const publicClient = makePublicClient({ maxFeePerGas: 3n })
    const plan = makePlan({
      hcaDeploymentRequired: true,
      preflight: {
        preExistingOwnedPermRes: null,
        skipApprovalPhase: false,
        skipFetchProfilesPhase: true,
        baseRegistrarApproved: false,
        nameWrapperApproved: true,
        migrationApprovals: [makeTokenApproval()],
      },
      atomicBatches: [makeAtomicBatch(100n)],
    })

    const estimate = await estimateMigrationGasCost({ plan, publicClient })

    expect(estimate.status).toBe('ready')
    if (estimate.status !== 'ready') throw new Error('expected ready estimate')
    // 450k deployment + 55k token approval + 100 batch gas. The ERC-721
    // approval clears automatically when the registration transfers.
    expect(estimate.gasUnits).toBe(505_100n)
    expect(estimate.feeWei).toBe(1_515_300n)
    expect(estimate.transactionCount).toBe(3)
    expect(publicClient.estimateGas).not.toHaveBeenCalled()
  })

  it('counts one confirmation for an existing HCA with permissions', async () => {
    const publicClient = makePublicClient({ maxFeePerGas: 4n })
    const plan = makePlan({
      atomicBatches: [makeAtomicBatch(111n)],
    })

    const estimate = await estimateMigrationGasCost({ plan, publicClient })

    expect(estimate.status).toBe('ready')
    if (estimate.status !== 'ready') throw new Error('expected ready estimate')
    expect(estimate.gasUnits).toBe(111n)
    expect(estimate.feeWei).toBe(444n)
    expect(estimate.transactionCount).toBe(1)
  })

  it('counts one persistent grant for a missing wrapped operator approval', async () => {
    const publicClient = makePublicClient({ maxFeePerGas: 2n })
    const plan = makePlan({
      preflight: {
        preExistingOwnedPermRes: null,
        skipApprovalPhase: false,
        skipFetchProfilesPhase: true,
        baseRegistrarApproved: true,
        nameWrapperApproved: false,
        migrationApprovals: [makeOperatorApproval('name-wrapper:hca')],
      },
      atomicBatches: [makeAtomicBatch(100n)],
    })

    const estimate = await estimateMigrationGasCost({ plan, publicClient })

    expect(estimate.status).toBe('ready')
    if (estimate.status !== 'ready') throw new Error('expected ready estimate')
    expect(estimate.gasUnits).toBe(55_100n)
    expect(estimate.transactionCount).toBe(2)
  })

  it('manager restoration adds one persistent grant confirmation', async () => {
    const publicClient = makePublicClient({ maxFeePerGas: 2n })
    const basePlan = makePlan({ atomicBatches: [makeAtomicBatch(100n)] })
    const managerPlan = makePlan({
      preflight: {
        ...basePlan.preflight,
        migrationApprovals: [makeOperatorApproval('eth-registry:hca')],
      },
      atomicBatches: [makeAtomicBatch(100n)],
    })

    const base = await estimateMigrationGasCost({
      plan: basePlan,
      publicClient,
    })
    const manager = await estimateMigrationGasCost({
      plan: managerPlan,
      publicClient,
    })

    expect(base.status).toBe('ready')
    expect(manager.status).toBe('ready')
    if (base.status !== 'ready' || manager.status !== 'ready') {
      throw new Error('expected ready estimates')
    }
    expect(manager.transactionCount - base.transactionCount).toBe(1)
  })

  it('every additional atomic batch adds one confirmation', async () => {
    const publicClient = makePublicClient({ maxFeePerGas: 2n })
    const plan = makePlan({
      atomicBatches: [makeAtomicBatch(100n), makeAtomicBatch(200n)],
    })

    const estimate = await estimateMigrationGasCost({ plan, publicClient })

    expect(estimate.status).toBe('ready')
    if (estimate.status !== 'ready') throw new Error('expected ready estimate')
    expect(estimate.transactionCount).toBe(2)
  })

  it('falls back to the legacy gas price field', async () => {
    const publicClient = makePublicClient({ gasPrice: 7n })
    const plan = makePlan({
      atomicBatches: [makeAtomicBatch(10n)],
    })

    const estimate = await estimateMigrationGasCost({ plan, publicClient })

    expect(estimate.status).toBe('ready')
    if (estimate.status !== 'ready') throw new Error('expected ready estimate')
    expect(estimate.feeWei).toBe(70n)
  })

  it('falls back to getGasPrice when fee history has neither fee field', async () => {
    const publicClient = makePublicClient({})
    const plan = makePlan({
      atomicBatches: [makeAtomicBatch(10n)],
    })

    const estimate = await estimateMigrationGasCost({ plan, publicClient })

    expect(estimate.status).toBe('ready')
    if (estimate.status !== 'ready') throw new Error('expected ready estimate')
    expect(estimate.feeWei).toBe(90n)
    expect(publicClient.getGasPrice).toHaveBeenCalledOnce()
  })

  it('returns unavailable when fee estimation fails', async () => {
    const publicClient = {
      estimateFeesPerGas: vi.fn().mockRejectedValueOnce(new Error('rpc down')),
    } as unknown as PublicClient

    const estimate = await estimateMigrationGasCost({
      plan: makePlan(),
      publicClient,
    })

    expect(estimate.status).toBe('error')
  })
})
