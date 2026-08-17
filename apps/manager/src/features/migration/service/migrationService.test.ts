import type { Signer } from '@ens-apps/transaction-manager'
import type { RhinestoneAccount } from '@rhinestone/sdk'
import type { Config as WagmiConfig } from '@wagmi/core'
import {
  type Address,
  encodeErrorResult,
  type Hex,
  type PublicClient,
  parseAbi,
  type TransactionReceipt,
} from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildHcaDeploymentCall: vi.fn(),
  verifyStandaloneHca: vi.fn(),
  startTransaction: vi.fn(),
  waitForTransactionHash: vi.fn(),
  waitForTransaction: vi.fn(),
  buildAtomicMigrationBatches: vi.fn(),
  checkMigrationApprovals: vi.fn(),
  planMigrationApprovals: vi.fn(),
  buildMigrationApprovalCall: vi.fn(),
  checkResolverReadiness: vi.fn(),
  reconcileAtomicMigrationBatch: vi.fn(),
  verifyAtomicMigrationBatch: vi.fn(),
}))

vi.mock('@ens-apps/smart-account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ens-apps/smart-account')>()),
  buildHcaDeploymentCall: mocks.buildHcaDeploymentCall,
  verifyStandaloneHca: mocks.verifyStandaloneHca,
}))

vi.mock('@ens-apps/transaction-manager', () => ({
  transactionManager: { startTransaction: mocks.startTransaction },
  waitForTransactionHash: mocks.waitForTransactionHash,
  waitForTransaction: mocks.waitForTransaction,
}))

vi.mock('./buildAtomicMigrationBatches', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./buildAtomicMigrationBatches')>()),
  buildAtomicMigrationBatches: mocks.buildAtomicMigrationBatches,
}))

vi.mock('./migrationApprovals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./migrationApprovals')>()),
  checkMigrationApprovals: mocks.checkMigrationApprovals,
  planMigrationApprovals: mocks.planMigrationApprovals,
  buildMigrationApprovalCall: mocks.buildMigrationApprovalCall,
}))

vi.mock('./migrationInvariants', () => ({
  checkDeterministicMigrationResolverReadiness: mocks.checkResolverReadiness,
}))

vi.mock('./verifyAtomicMigrationBatch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./verifyAtomicMigrationBatch')>()),
  reconcileAtomicMigrationBatch: mocks.reconcileAtomicMigrationBatch,
  verifyAtomicMigrationBatch: mocks.verifyAtomicMigrationBatch,
}))

import type { BuildAtomicMigrationBatchesParams } from './buildAtomicMigrationBatches'
import type { MigrationPlan } from './buildMigrationPlan'
import type { ClassifiedName } from './classifyNames'
import type { MigrationApproval } from './migrationApprovals'
import {
  loadPendingAtomicMigrationIntents,
  loadSubmittedAtomicMigrationBatches,
  persistPendingAtomicMigrationIntent,
  persistSubmittedAtomicMigrationBatch,
} from './migrationBatchJournal'
import { executeMigration, type MigrationProgress } from './migrationService'
import type { V1Domain } from './v1SubgraphClient'
import {
  AtomicMigrationBatchReconciliationIndeterminateError,
  AtomicMigrationBatchVerificationError,
} from './verifyAtomicMigrationBatch'

const OWNER: Address = '0x0000000000000000000000000000000000000001'
const HCA: Address = '0x0000000000000000000000000000000000000002'
const FACTORY: Address = '0x0000000000000000000000000000000000000003'
const RESOLVER: Address = '0x0000000000000000000000000000000000000004'
const V1_RESOLVER: Address = '0x0000000000000000000000000000000000000005'
const APPROVAL_CONTRACT: Address = '0x0000000000000000000000000000000000000006'

const DEPLOY_DATA: Hex = '0xd3ad'
const OUTER_DATA: Hex = '0xcafe'
const GRANT_DATA: Hex = '0x01'
const DIRECT_PERMISSION_ERROR_ABI = parseAbi([
  'error ERC721InsufficientApproval(address operator, uint256 tokenId)',
])

const WAGMI = {} as WagmiConfig
const SIGNER = {
  type: 'eoa',
  walletClient: {},
} as unknown as Signer
const HCA_CLIENT = {
  getAddress: vi.fn(() => HCA),
  getInitData: vi.fn(),
} as unknown as Pick<RhinestoneAccount, 'getAddress' | 'getInitData'>

const getCodeMock = vi.fn()
const estimateGasMock = vi.fn()
const readContractMock = vi.fn()
const getTransactionReceiptMock = vi.fn()
const waitForReceiptMock = vi.fn()
const PUBLIC_CLIENT = {
  chain: { id: 11155111 },
  getCode: getCodeMock,
  estimateGas: estimateGasMock,
  readContract: readContractMock,
  getTransactionReceipt: getTransactionReceiptMock,
  waitForTransactionReceipt: waitForReceiptMock,
} as unknown as PublicClient

const APPROVAL: MigrationApproval = {
  kind: 'operator',
  id: 'base-registrar:hca',
  contractAddress: APPROVAL_CONTRACT,
  operatorAddress: HCA,
}
const MANAGER_APPROVAL: MigrationApproval = {
  kind: 'operator',
  id: 'eth-registry:hca',
  contractAddress: APPROVAL_CONTRACT,
  operatorAddress: HCA,
}

const hashFor = (value: number): Hex =>
  `0x${value.toString(16).padStart(64, '0')}` as Hex

const permissionMissingError = (): Error & { readonly data: Hex } =>
  Object.assign(new Error('ERC-721 approval is not visible yet'), {
    data: encodeErrorResult({
      abi: DIRECT_PERMISSION_ERROR_ABI,
      errorName: 'ERC721InsufficientApproval',
      args: [HCA, 2n],
    }),
  })

const domainFor = (label: string): V1Domain =>
  ({
    id: label,
    name: `${label}.eth`,
    labelName: label,
    labelhash:
      '0x0000000000000000000000000000000000000000000000000000000000000002',
    resolver: { address: V1_RESOLVER },
    owner: { id: OWNER },
    registrant: { id: OWNER },
    wrappedOwner: null,
    parent: { name: 'eth', wrappedDomain: null },
    registration: null,
    wrappedDomain: null,
  }) as V1Domain

const classifiedFor = (label: string): ClassifiedName => ({
  domain: domainFor(label),
  tokenType: 'unwrapped',
  label,
  parentName: 'eth',
  fuses: 0n,
  tokenHolder: OWNER,
  v1ResolverAddress: V1_RESOLVER,
  resolverStrategy: 'to-owned-permres',
  managerAddress: null,
})

const planFor = (labels: readonly string[] = ['alice']): MigrationPlan => {
  const classified = labels.map(classifiedFor)
  const nameExecutions = classified.map((classifiedName) => {
    const name = classifiedName.domain.name
    const directRoute = {
      name,
      receiver: RESOLVER,
      parentDependency: null,
      expectedWrapperRegistry: null,
      receiverReadiness: 'migration-controller' as const,
    }
    return {
      classified: classifiedName,
      directRoute,
      migrationData: {
        label: classifiedName.label,
        owner: OWNER,
        subregistry: RESOLVER,
        resolver: RESOLVER,
      },
      innerExecutions: [],
      verificationExpectations: [
        {
          id: `${name}:name-owner`,
          type: 'name-owner' as const,
          name,
          label: classifiedName.label,
          node: classifiedName.domain.id as Hex,
          resource: 1n,
          tokenType: classifiedName.tokenType,
          registryPath: {
            type: 'eth-registry-2ld' as const,
            registry: RESOLVER,
            label: classifiedName.label,
            resource: 1n,
          },
          expectedOwner: OWNER,
        },
      ],
    }
  })
  return {
    hcaAddress: HCA,
    hcaDeploymentRequired: false,
    migrationOwner: OWNER,
    domains: classified.map(({ domain }) => domain),
    classified,
    ineligible: [],
    groups: {
      unwrapped: classified,
      unlocked: [],
      locked2ld: [],
      childNames: new Map(),
    },
    preflight: {
      preExistingOwnedPermRes: null,
      skipApprovalPhase: false,
      skipFetchProfilesPhase: true,
      baseRegistrarApproved: false,
      nameWrapperApproved: false,
    },
    ownedPermRes: RESOLVER,
    profiles: new Map(),
    directRoutes: new Map(
      nameExecutions.map((execution) => [
        execution.classified.domain.name,
        execution.directRoute,
      ]),
    ),
    atomicBatches:
      nameExecutions.length === 0
        ? []
        : [
            {
              index: 0,
              names: nameExecutions.map(
                ({ classified: name }) => name.domain.name,
              ),
              nameExecutions,
              innerExecutions: [],
              outerCall: { to: HCA, data: OUTER_DATA, value: 0n },
              estimatedGas: 500_000n,
              verificationExpectations: nameExecutions.flatMap(
                (execution) => execution.verificationExpectations,
              ),
            },
          ],
    stepDescriptors: [],
  }
}

const runExecute = async (
  overrides: {
    plan?: MigrationPlan
    refreshAccount?: () => Promise<void>
    onBatchComplete?: (names: readonly string[], hash?: Hex) => void
    reconcileBeforeSubmit?: boolean
  } = {},
) => {
  const progressEvents: MigrationProgress[] = []
  const refreshAccount = overrides.refreshAccount ?? vi.fn()
  const result = await executeMigration({
    plan: overrides.plan ?? planFor(),
    wagmiConfig: WAGMI,
    publicClient: PUBLIC_CLIENT,
    signer: SIGNER,
    hcaClient: HCA_CLIENT,
    refreshAccount,
    onProgress: (progress) => progressEvents.push(progress),
    onBatchComplete: overrides.onBatchComplete,
    reconcileBeforeSubmit: overrides.reconcileBeforeSubmit,
  })
  return { progressEvents, refreshAccount, result }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()

  let nextTransaction = 0
  mocks.startTransaction.mockImplementation(() => `tx-${nextTransaction++}`)
  const hashForTransaction = (txId: string) =>
    hashFor(Number.parseInt(txId.slice('tx-'.length), 10) + 1)
  mocks.waitForTransactionHash.mockImplementation((txId: string) =>
    Promise.resolve(hashForTransaction(txId)),
  )
  mocks.waitForTransaction.mockImplementation((txId: string) =>
    Promise.resolve({ hash: hashForTransaction(txId) }),
  )

  mocks.buildHcaDeploymentCall.mockReturnValue({
    to: FACTORY,
    data: DEPLOY_DATA,
    value: 0n,
  })
  mocks.verifyStandaloneHca.mockResolvedValue(HCA)
  mocks.checkMigrationApprovals.mockResolvedValue({})
  mocks.planMigrationApprovals.mockReturnValue([])
  mocks.buildMigrationApprovalCall.mockImplementation(
    (approval: MigrationApproval) => ({
      to: approval.contractAddress,
      data: GRANT_DATA,
      value: 0n,
    }),
  )
  mocks.checkResolverReadiness.mockResolvedValue({
    status: 'verified',
    resolver: RESOLVER,
    implementation: RESOLVER,
    hcaHasRootRoles: true,
    walletHasWildcardRoles: true,
  })
  mocks.buildAtomicMigrationBatches.mockImplementation(
    async ({
      hca,
      classified,
      estimateOuterGas,
    }: BuildAtomicMigrationBatchesParams) => {
      const names = classified.map(({ domain }) => domain.name)
      const outerCall = { to: hca, data: OUTER_DATA, value: 0n }
      const estimatedGas = await estimateOuterGas({
        call: outerCall,
        names,
        innerExecutions: [],
      })
      return {
        resolver: RESOLVER,
        batches: [
          {
            index: 0,
            names,
            nameExecutions: [],
            innerExecutions: [],
            outerCall,
            estimatedGas,
            verificationExpectations: [],
          },
        ],
      }
    },
  )
  mocks.reconcileAtomicMigrationBatch.mockResolvedValue({
    status: 'complete',
    verification: { batchIndex: 0, status: 'confirmed', results: [] },
  })
  mocks.verifyAtomicMigrationBatch.mockResolvedValue({
    batchIndex: 0,
    status: 'confirmed',
    results: [],
  })

  getCodeMock.mockResolvedValue('0x6000')
  estimateGasMock.mockResolvedValue(500_000n)
  readContractMock.mockImplementation(
    ({ functionName }: { functionName: string }) => {
      if (functionName === 'ownerOf') return Promise.resolve(OWNER)
      if (functionName === 'balanceOf') return Promise.resolve(1n)
      return Promise.resolve(true)
    },
  )
  getTransactionReceiptMock.mockResolvedValue({
    status: 'success',
    blockNumber: 123n,
  } as TransactionReceipt)
  waitForReceiptMock.mockResolvedValue({
    status: 'success',
    blockNumber: 123n,
  } as TransactionReceipt)
})

describe('executeMigration HCA orchestration', () => {
  it('deploys an undeployed HCA directly from the wallet and refreshes account state', async () => {
    getCodeMock.mockResolvedValueOnce('0x')
    const refreshAccount = vi.fn(() => Promise.resolve())

    const { result } = await runExecute({ refreshAccount })

    expect(mocks.buildHcaDeploymentCall).toHaveBeenCalledWith({
      client: HCA_CLIENT,
      chainId: 11155111,
      expectedHca: HCA,
      expectedOwner: OWNER,
    })
    expect(mocks.startTransaction.mock.calls[0]?.[0]).toMatchObject({
      type: 'custom',
      request: {
        type: 'eoa',
        from: OWNER,
        to: FACTORY,
        data: DEPLOY_DATA,
        value: 0n,
        chainId: 11155111,
      },
    })
    expect(mocks.verifyStandaloneHca).toHaveBeenCalledWith(
      expect.objectContaining({
        publicClient: PUBLIC_CLIENT,
        hca: HCA,
        expectedOwner: OWNER,
      }),
    )
    expect(refreshAccount).toHaveBeenCalledOnce()
    expect(result.completed).toBe(1)
    expect(result.txHashes).toEqual([hashFor(1), hashFor(2)])
  })

  it('rejects mismatched HCA deployment data before opening a wallet transaction', async () => {
    getCodeMock.mockResolvedValueOnce('0x')
    mocks.buildHcaDeploymentCall.mockImplementationOnce(() => {
      throw new Error('HCA deployment clientHca mismatch')
    })

    await expect(runExecute()).rejects.toSatisfy(
      (error) => error instanceof Error && error.name === 'MigrationError',
    )

    expect(mocks.startTransaction).not.toHaveBeenCalled()
    expect(mocks.verifyStandaloneHca).not.toHaveBeenCalled()
  })

  it('consumes a planned deployment step when a retry finds the HCA already deployed', async () => {
    const plan = {
      ...planFor(),
      hcaDeploymentRequired: true,
      stepDescriptors: [
        { type: 'deploy-hca' as const },
        { type: 'atomic-batch' as const, index: 0, total: 1, count: 1 },
      ],
    }

    const { progressEvents } = await runExecute({ plan })

    expect(mocks.buildHcaDeploymentCall).not.toHaveBeenCalled()
    expect(progressEvents).toContainEqual(
      expect.objectContaining({
        currentStep: 1,
        totalSteps: 2,
        description: 'HCA already ready',
      }),
    )
    expect(progressEvents.at(-1)).toMatchObject({
      currentStep: 2,
      totalSteps: 2,
      description: 'Atomic batch verified',
    })
  })

  it('submits executeByOwner as a wallet-paid EOA transaction targeting the HCA', async () => {
    await runExecute()

    expect(mocks.startTransaction).toHaveBeenCalledOnce()
    expect(mocks.startTransaction).toHaveBeenCalledWith(
      {
        type: 'custom',
        request: {
          type: 'eoa',
          from: OWNER,
          to: HCA,
          data: OUTER_DATA,
          value: 0n,
          chainId: 11155111,
        },
      },
      SIGNER,
      expect.objectContaining({ publicClient: PUBLIC_CLIENT }),
    )
  })

  it('updates retry protection when the wallet replaces the submitted transaction', async () => {
    const replacementReceipt = {
      status: 'success',
      blockNumber: 123n,
      transactionHash: hashFor(9),
    } as TransactionReceipt
    mocks.waitForTransaction.mockResolvedValueOnce({
      hash: hashFor(9),
      receipt: replacementReceipt,
    })
    mocks.verifyAtomicMigrationBatch.mockImplementationOnce(() => {
      expect(
        loadSubmittedAtomicMigrationBatches({
          chainId: 11155111,
          owner: OWNER,
          hca: HCA,
        }),
      ).toEqual([
        expect.objectContaining({
          hash: hashFor(9),
          names: ['alice.eth'],
        }),
      ])
      return Promise.resolve({
        batchIndex: 0,
        status: 'confirmed' as const,
        results: [],
      })
    })

    const { result } = await runExecute()

    expect(result.txHashes).toEqual([hashFor(9)])
    expect(
      loadSubmittedAtomicMigrationBatches({
        chainId: 11155111,
        owner: OWNER,
        hca: HCA,
      }),
    ).toEqual([])
  })

  it('submits a persistent approval before the atomic batch', async () => {
    mocks.planMigrationApprovals.mockReturnValue([APPROVAL])
    waitForReceiptMock.mockResolvedValueOnce({
      status: 'reverted',
      blockNumber: 123n,
    } as TransactionReceipt)
    const plan = {
      ...planFor(),
      preflight: {
        ...planFor().preflight,
        migrationApprovals: [APPROVAL],
      },
    }

    await expect(runExecute({ plan })).rejects.toSatisfy(
      (error) => error instanceof Error && error.name === 'MigrationError',
    )

    expect(mocks.buildMigrationApprovalCall).toHaveBeenCalledWith(APPROVAL)
    expect(mocks.buildAtomicMigrationBatches).not.toHaveBeenCalled()
  })

  it('keeps temporary-approval cleanup within the planned step count', async () => {
    mocks.planMigrationApprovals.mockReturnValue([APPROVAL, MANAGER_APPROVAL])
    const plan = {
      ...planFor(),
      preflight: {
        ...planFor().preflight,
        migrationApprovals: [APPROVAL, MANAGER_APPROVAL],
      },
      stepDescriptors: [
        { type: 'approval' as const, approvalId: APPROVAL.id },
        { type: 'approval' as const, approvalId: MANAGER_APPROVAL.id },
        { type: 'atomic-batch' as const, index: 0, total: 1, count: 1 },
        { type: 'cleanup' as const, approvalId: MANAGER_APPROVAL.id },
      ],
    }

    const { progressEvents } = await runExecute({ plan })

    expect(
      Math.max(...progressEvents.map(({ currentStep }) => currentStep)),
    ).toBe(4)
    expect(progressEvents.at(-1)).toMatchObject({
      currentStep: 4,
      totalSteps: 4,
      description: 'Temporary access removed',
    })
  })

  it('retries a permission-shaped gas estimate after a freshly mined approval', async () => {
    vi.useFakeTimers()
    try {
      mocks.planMigrationApprovals.mockReturnValue([APPROVAL])
      estimateGasMock
        .mockRejectedValueOnce(permissionMissingError())
        .mockResolvedValueOnce(500_000n)
      const plan = {
        ...planFor(),
        preflight: {
          ...planFor().preflight,
          migrationApprovals: [APPROVAL],
        },
      }

      const execution = runExecute({ plan })
      await vi.runAllTimersAsync()
      const { result } = await execution

      expect(estimateGasMock).toHaveBeenCalledTimes(2)
      expect(estimateGasMock).toHaveBeenNthCalledWith(1, {
        account: OWNER,
        to: HCA,
        data: OUTER_DATA,
        value: 0n,
      })
      expect(estimateGasMock).toHaveBeenNthCalledWith(2, {
        account: OWNER,
        to: HCA,
        data: OUTER_DATA,
        value: 0n,
      })
      expect(mocks.buildMigrationApprovalCall).toHaveBeenCalledOnce()
      expect(mocks.startTransaction).toHaveBeenCalledTimes(2)
      expect(result.txHashes).toEqual([hashFor(1), hashFor(2)])
    } finally {
      vi.useRealTimers()
    }
  })

  it('bounds stale-approval estimate retries before opening the atomic wallet prompt', async () => {
    vi.useFakeTimers()
    try {
      mocks.planMigrationApprovals.mockReturnValue([APPROVAL])
      estimateGasMock.mockRejectedValue(permissionMissingError())
      const plan = {
        ...planFor(),
        preflight: {
          ...planFor().preflight,
          migrationApprovals: [APPROVAL],
        },
      }

      const execution = runExecute({ plan }).catch((error: unknown) => error)
      await vi.runAllTimersAsync()
      const error = await execution

      expect(error).toBeInstanceOf(Error)
      expect(estimateGasMock).toHaveBeenCalledTimes(6)
      expect(mocks.buildMigrationApprovalCall).toHaveBeenCalledOnce()
      expect(mocks.startTransaction).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retry unrelated gas-estimation failures', async () => {
    mocks.planMigrationApprovals.mockReturnValue([APPROVAL])
    estimateGasMock.mockRejectedValueOnce(new Error('RPC unavailable'))
    const plan = {
      ...planFor(),
      preflight: {
        ...planFor().preflight,
        migrationApprovals: [APPROVAL],
      },
    }

    await expect(runExecute({ plan })).rejects.toBeInstanceOf(Error)

    expect(estimateGasMock).toHaveBeenCalledOnce()
    expect(mocks.startTransaction).toHaveBeenCalledOnce()
  })

  it('blocks a stale permission preview before opening the first wallet prompt', async () => {
    getCodeMock.mockResolvedValueOnce('0x')
    const plan = {
      ...planFor(),
      hcaDeploymentRequired: true,
      preflight: {
        ...planFor().preflight,
        migrationApprovals: [APPROVAL],
      },
      stepDescriptors: [
        { type: 'approval' as const, approvalId: APPROVAL.id },
        { type: 'atomic-batch' as const, index: 0, total: 1, count: 1 },
      ],
    }

    const error = await runExecute({ plan }).catch((cause: unknown) => cause)

    expect(error).toMatchObject({
      name: 'MigrationPlanChangedError',
      plannedApprovalKeys: [
        `${APPROVAL.contractAddress.toLowerCase()}:${APPROVAL.operatorAddress.toLowerCase()}`,
      ],
      currentApprovalKeys: [],
    })
    expect(mocks.buildHcaDeploymentCall).not.toHaveBeenCalled()
    expect(mocks.verifyStandaloneHca).not.toHaveBeenCalled()
    expect(mocks.startTransaction).not.toHaveBeenCalled()
    expect(mocks.buildMigrationApprovalCall).not.toHaveBeenCalled()
  })

  it('does not emit batchComplete until all post-state verification succeeds', async () => {
    mocks.verifyAtomicMigrationBatch.mockRejectedValueOnce(
      new Error('owner mismatch'),
    )
    const onBatchComplete = vi.fn()

    await expect(runExecute({ onBatchComplete })).rejects.toSatisfy(
      (error) => error instanceof Error && error.name === 'MigrationError',
    )

    expect(mocks.verifyAtomicMigrationBatch).toHaveBeenCalledWith({
      publicClient: PUBLIC_CLIENT,
      batch: expect.objectContaining({ names: ['alice.eth'] }),
      blockNumber: 123n,
    })
    expect(onBatchComplete).not.toHaveBeenCalled()
  })

  it('persists an atomic batch hash before post-state verification', async () => {
    mocks.verifyAtomicMigrationBatch.mockRejectedValueOnce(
      new Error('owner mismatch'),
    )

    await expect(runExecute()).rejects.toSatisfy(
      (error) => error instanceof Error && error.name === 'MigrationError',
    )

    expect(
      loadSubmittedAtomicMigrationBatches({
        chainId: 11155111,
        owner: OWNER,
        hca: HCA,
      }),
    ).toEqual([
      expect.objectContaining({
        hash: hashFor(1),
        names: ['alice.eth'],
      }),
    ])
    expect(
      loadPendingAtomicMigrationIntents({
        chainId: 11155111,
        owner: OWNER,
        hca: HCA,
      }),
    ).toEqual([])
    expect(mocks.waitForTransactionHash).toHaveBeenCalledWith('tx-0')
  })

  it('blocks an intent whose broadcast hash was not durably recorded', async () => {
    persistPendingAtomicMigrationIntent(
      { chainId: 11155111, owner: OWNER, hca: HCA },
      { id: 'unresolved-intent', names: ['alice.eth'] },
    )

    const error = await runExecute().catch((cause: unknown) => cause)

    expect(error).toMatchObject({
      name: 'MigrationError',
      step: 'Reconciling previous atomic migration',
      cause: { name: 'AtomicMigrationIntentIndeterminateError' },
    })
    expect(mocks.startTransaction).not.toHaveBeenCalled()
  })

  it('durably records the batch intent before opening the wallet prompt', async () => {
    mocks.startTransaction.mockImplementationOnce(() => {
      expect(
        loadPendingAtomicMigrationIntents({
          chainId: 11155111,
          owner: OWNER,
          hca: HCA,
        }),
      ).toEqual([
        expect.objectContaining({
          names: ['alice.eth'],
        }),
      ])
      return 'tx-0'
    })

    await runExecute()

    expect(mocks.startTransaction).toHaveBeenCalledOnce()
  })

  it('keeps retry protection when submission fails before returning a hash', async () => {
    mocks.waitForTransactionHash.mockRejectedValueOnce(
      new Error('provider response was lost'),
    )

    await expect(runExecute()).rejects.toSatisfy(
      (error) => error instanceof Error && error.name === 'MigrationError',
    )

    expect(
      loadPendingAtomicMigrationIntents({
        chainId: 11155111,
        owner: OWNER,
        hca: HCA,
      }),
    ).toEqual([expect.objectContaining({ names: ['alice.eth'] })])

    mocks.reconcileAtomicMigrationBatch.mockResolvedValueOnce({
      status: 'incomplete',
      verification: {
        batchIndex: 0,
        status: 'confirmed',
        results: [{ expectationId: 'alice.eth:name-owner', satisfied: false }],
      },
      mismatches: [{ expectationId: 'alice.eth:name-owner' }],
    })

    await expect(
      runExecute({
        reconcileBeforeSubmit: true,
      }),
    ).resolves.toBeDefined()
    expect(mocks.startTransaction).toHaveBeenCalledTimes(2)
    expect(
      loadPendingAtomicMigrationIntents({
        chainId: 11155111,
        owner: OWNER,
        hca: HCA,
      }),
    ).toEqual([])
  })

  it('clears an unsubmitted intent after an explicit wallet rejection', async () => {
    const rejection = Object.assign(new Error('User rejected the request'), {
      name: 'UserRejectedRequestError',
    })
    mocks.waitForTransactionHash.mockRejectedValueOnce(rejection)

    await expect(runExecute()).rejects.toSatisfy(
      (error) =>
        error instanceof Error && error.name === 'MigrationUserRejectedError',
    )

    expect(
      loadPendingAtomicMigrationIntents({
        chainId: 11155111,
        owner: OWNER,
        hca: HCA,
      }),
    ).toEqual([])

    mocks.reconcileAtomicMigrationBatch.mockResolvedValueOnce({
      status: 'incomplete',
      verification: {
        batchIndex: 0,
        status: 'confirmed',
        results: [{ expectationId: 'alice.eth:name-owner', satisfied: false }],
      },
      mismatches: [{ expectationId: 'alice.eth:name-owner' }],
    })

    await expect(
      runExecute({ reconcileBeforeSubmit: true }),
    ).resolves.toBeDefined()
    expect(mocks.startTransaction).toHaveBeenCalledTimes(2)
  })

  it('never resubmits a confirmed-success batch whose post-state does not verify', async () => {
    mocks.verifyAtomicMigrationBatch.mockRejectedValue(
      new AtomicMigrationBatchVerificationError({
        message: 'owner mismatch',
        batchIndex: 0,
        verification: {
          batchIndex: 0,
          status: 'confirmed',
          results: [
            { expectationId: 'alice.eth:name-owner', satisfied: false },
          ],
        },
        failures: [{ expectationId: 'alice.eth:name-owner' }],
      }),
    )
    await expect(runExecute()).rejects.toBeInstanceOf(Error)
    expect(mocks.startTransaction).toHaveBeenCalledOnce()

    const error = await runExecute({
      reconcileBeforeSubmit: true,
    }).catch((cause: unknown) => cause)

    expect(error).toMatchObject({
      name: 'MigrationError',
      step: 'Reconciling previous atomic migration',
      cause: { name: 'SubmittedAtomicMigrationVerificationError' },
    })
    expect(getTransactionReceiptMock).toHaveBeenCalledWith({
      hash: hashFor(1),
    })
    expect(mocks.startTransaction).toHaveBeenCalledOnce()
    expect(mocks.reconcileAtomicMigrationBatch).not.toHaveBeenCalled()
  })

  it('retries a reverted journaled batch only while its source token is still owned', async () => {
    persistSubmittedAtomicMigrationBatch(
      { chainId: 11155111, owner: OWNER, hca: HCA },
      {
        intentId: 'reverted-intent',
        hash: hashFor(9),
        names: ['alice.eth'],
      },
    )
    getTransactionReceiptMock.mockResolvedValueOnce({
      status: 'reverted',
      blockNumber: 122n,
    } as TransactionReceipt)

    const { result } = await runExecute()

    expect(readContractMock).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'ownerOf',
        args: [BigInt(planFor().classified[0]?.domain.labelhash ?? 0)],
      }),
    )
    expect(mocks.startTransaction).toHaveBeenCalledOnce()
    expect(result.txHashes).toEqual([hashFor(1)])
    expect(
      loadSubmittedAtomicMigrationBatches({
        chainId: 11155111,
        owner: OWNER,
        hca: HCA,
      }),
    ).toEqual([])
  })

  it('reconciles current state when a replacement makes the journaled hash unavailable', async () => {
    persistSubmittedAtomicMigrationBatch(
      { chainId: 11155111, owner: OWNER, hca: HCA },
      {
        intentId: 'replaced-intent',
        hash: hashFor(9),
        names: ['alice.eth'],
      },
    )
    getTransactionReceiptMock.mockRejectedValueOnce(
      new Error('transaction not found'),
    )
    mocks.reconcileAtomicMigrationBatch.mockResolvedValueOnce({
      status: 'incomplete',
      verification: {
        batchIndex: 0,
        status: 'confirmed',
        results: [{ expectationId: 'alice.eth:name-owner', satisfied: false }],
      },
      mismatches: [{ expectationId: 'alice.eth:name-owner' }],
    })

    await expect(
      runExecute({ reconcileBeforeSubmit: true }),
    ).resolves.toBeDefined()

    expect(readContractMock).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'ownerOf' }),
    )
    expect(mocks.startTransaction).toHaveBeenCalledOnce()
    expect(
      loadSubmittedAtomicMigrationBatches({
        chainId: 11155111,
        owner: OWNER,
        hca: HCA,
      }),
    ).toEqual([])
  })

  it('reconciles an already-complete batch on retry without resubmitting it', async () => {
    const onBatchComplete = vi.fn()

    const { result } = await runExecute({
      onBatchComplete,
      reconcileBeforeSubmit: true,
    })

    expect(mocks.reconcileAtomicMigrationBatch).toHaveBeenCalledWith({
      publicClient: PUBLIC_CLIENT,
      batch: {
        index: 0,
        verificationExpectations: [
          expect.objectContaining({ id: 'alice.eth:name-owner' }),
        ],
      },
    })
    expect(mocks.buildAtomicMigrationBatches).not.toHaveBeenCalled()
    expect(estimateGasMock).not.toHaveBeenCalled()
    expect(mocks.startTransaction).not.toHaveBeenCalled()
    expect(onBatchComplete).toHaveBeenCalledWith(['alice.eth'])
    expect(result.completed).toBe(1)
    expect(result.txHashes).toEqual([])
  })

  it('finishes progress at the planned total when retry reconciliation skips setup and submission', async () => {
    const plan = {
      ...planFor(),
      hcaDeploymentRequired: true,
      preflight: {
        ...planFor().preflight,
        migrationApprovals: [MANAGER_APPROVAL],
      },
      stepDescriptors: [
        { type: 'deploy-hca' as const },
        { type: 'approval' as const, approvalId: MANAGER_APPROVAL.id },
        { type: 'atomic-batch' as const, index: 0, total: 1, count: 1 },
        { type: 'cleanup' as const, approvalId: MANAGER_APPROVAL.id },
      ],
    }

    const { progressEvents } = await runExecute({
      plan,
      reconcileBeforeSubmit: true,
    })

    expect(mocks.startTransaction).toHaveBeenCalledOnce()
    expect(progressEvents.at(-1)).toMatchObject({
      currentStep: 4,
      totalSteps: 4,
      description: 'Migration complete',
    })
    expect(progressEvents.every(({ currentStep }) => currentStep <= 4)).toBe(
      true,
    )
  })

  it('reconciles every name before rebuilding only deterministic mismatches', async () => {
    mocks.reconcileAtomicMigrationBatch
      .mockResolvedValueOnce({
        status: 'complete',
        verification: { batchIndex: 0, status: 'confirmed', results: [] },
      })
      .mockResolvedValueOnce({
        status: 'incomplete',
        verification: {
          batchIndex: 0,
          status: 'confirmed',
          results: [{ expectationId: 'bob.eth:name-owner', satisfied: false }],
        },
        mismatches: [{ expectationId: 'bob.eth:name-owner' }],
      })
    const onBatchComplete = vi.fn()

    await runExecute({
      plan: planFor(['alice', 'bob']),
      onBatchComplete,
      reconcileBeforeSubmit: true,
    })

    expect(mocks.reconcileAtomicMigrationBatch).toHaveBeenCalledTimes(2)
    expect(
      mocks.reconcileAtomicMigrationBatch.mock.invocationCallOrder[1],
    ).toBeLessThan(
      mocks.buildAtomicMigrationBatches.mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY,
    )
    expect(mocks.buildAtomicMigrationBatches).toHaveBeenCalledWith(
      expect.objectContaining({
        classified: [expect.objectContaining({ label: 'bob' })],
      }),
    )
    expect(onBatchComplete).toHaveBeenNthCalledWith(1, ['alice.eth'])
    expect(onBatchComplete).toHaveBeenNthCalledWith(2, ['bob.eth'], hashFor(1))
  })

  it('does not rebuild or submit when retry reconciliation has an indeterminate read', async () => {
    const readFailure = new Error('RPC unavailable')
    mocks.reconcileAtomicMigrationBatch.mockRejectedValueOnce(
      new AtomicMigrationBatchReconciliationIndeterminateError({
        message: 'post-state read failed',
        batchIndex: 0,
        readFailures: [
          { expectationId: 'alice.eth:name-owner', cause: readFailure },
        ],
        cause: readFailure,
      }),
    )

    const error = await runExecute({
      reconcileBeforeSubmit: true,
    }).catch((cause: unknown) => cause)

    expect(error).toMatchObject({
      name: 'MigrationError',
      step: 'Reconciling previous atomic migration',
    })
    expect(mocks.buildAtomicMigrationBatches).not.toHaveBeenCalled()
    expect(estimateGasMock).not.toHaveBeenCalled()
    expect(mocks.startTransaction).not.toHaveBeenCalled()
  })

  it('treats deterministic verification mismatches as safe to rebuild', async () => {
    const mismatch = new AtomicMigrationBatchVerificationError({
      message: 'owner mismatch',
      batchIndex: 0,
      verification: {
        batchIndex: 0,
        status: 'confirmed',
        results: [{ expectationId: 'alice.eth:name-owner', satisfied: false }],
      },
      failures: [{ expectationId: 'alice.eth:name-owner' }],
    })
    mocks.reconcileAtomicMigrationBatch.mockResolvedValueOnce({
      status: 'incomplete',
      verification: mismatch.verification,
      mismatches: mismatch.failures,
    })

    await runExecute({ reconcileBeforeSubmit: true })

    expect(mocks.buildAtomicMigrationBatches).toHaveBeenCalledOnce()
    expect(mocks.startTransaction).toHaveBeenCalledOnce()
  })

  it('blocks a deterministic retry mismatch when the source token is no longer wallet-owned', async () => {
    mocks.reconcileAtomicMigrationBatch.mockResolvedValueOnce({
      status: 'incomplete',
      verification: {
        batchIndex: 0,
        status: 'confirmed',
        results: [{ expectationId: 'alice.eth:name-owner', satisfied: false }],
      },
      mismatches: [{ expectationId: 'alice.eth:name-owner' }],
    })
    readContractMock.mockResolvedValueOnce(
      '0x0000000000000000000000000000000000000099',
    )

    const error = await runExecute({
      reconcileBeforeSubmit: true,
    }).catch((cause: unknown) => cause)

    expect(error).toMatchObject({
      name: 'MigrationError',
      step: 'Reconciling previous atomic migration',
      cause: { name: 'MigrationSourceOwnershipError' },
    })
    expect(mocks.startTransaction).not.toHaveBeenCalled()
  })

  it('fails closed when the retry plan has no stored expectations for a name', async () => {
    const plan = { ...planFor(), atomicBatches: [] }

    const error = await runExecute({
      plan,
      reconcileBeforeSubmit: true,
    }).catch((cause: unknown) => cause)

    expect(error).toMatchObject({
      name: 'MigrationError',
      step: 'Reconciling previous atomic migration',
    })
    expect(mocks.reconcileAtomicMigrationBatch).not.toHaveBeenCalled()
    expect(mocks.buildAtomicMigrationBatches).not.toHaveBeenCalled()
    expect(mocks.startTransaction).not.toHaveBeenCalled()
  })

  it('revokes a temporary operator approval after a successful migration', async () => {
    mocks.planMigrationApprovals.mockReturnValue([MANAGER_APPROVAL])
    waitForReceiptMock
      .mockResolvedValueOnce({
        status: 'success',
        blockNumber: 121n,
      } as TransactionReceipt)
      .mockResolvedValueOnce({
        status: 'success',
        blockNumber: 122n,
      } as TransactionReceipt)

    const plan = {
      ...planFor(),
      preflight: {
        ...planFor().preflight,
        migrationApprovals: [MANAGER_APPROVAL],
      },
    }
    const { result } = await runExecute({ plan })

    expect(mocks.buildMigrationApprovalCall).toHaveBeenCalledOnce()
    expect(mocks.buildMigrationApprovalCall).toHaveBeenCalledWith(
      MANAGER_APPROVAL,
    )
    expect(result.completed).toBe(1)
    expect(result.txHashes).toEqual([hashFor(1), hashFor(2), hashFor(3)])
  })

  it('surfaces cleanup rejection for the dedicated recovery action', async () => {
    mocks.planMigrationApprovals.mockReturnValue([MANAGER_APPROVAL])
    mocks.waitForTransactionHash.mockImplementation((txId: string) =>
      txId === 'tx-2'
        ? Promise.reject(new Error('cleanup rejected'))
        : Promise.resolve(
            hashFor(Number.parseInt(txId.slice('tx-'.length), 10) + 1),
          ),
    )
    const plan = {
      ...planFor(),
      preflight: {
        ...planFor().preflight,
        migrationApprovals: [MANAGER_APPROVAL],
      },
    }

    const error = await runExecute({ plan }).catch((cause: unknown) => cause)

    expect(error).toMatchObject({ name: 'MigrationCleanupError' })
    expect(mocks.verifyAtomicMigrationBatch).toHaveBeenCalledOnce()
  })

  it('returns immediately when no eligible names remain', async () => {
    const result = await executeMigration({
      plan: planFor([]),
      wagmiConfig: WAGMI,
      publicClient: PUBLIC_CLIENT,
      signer: SIGNER,
      hcaClient: HCA_CLIENT,
      refreshAccount: vi.fn(),
      onProgress: vi.fn(),
    })

    expect(result).toEqual({
      completed: 0,
      txHashes: [],
      ineligible: [],
    })
    expect(getCodeMock).not.toHaveBeenCalled()
    expect(mocks.startTransaction).not.toHaveBeenCalled()
  })
})
