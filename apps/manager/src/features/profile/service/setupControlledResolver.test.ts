import type { Address, PublicClient } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ens-apps/transaction-manager', () => ({
  getSmartAccountAddress: (signer: { config: { accountAddress: Address } }) =>
    signer.config.accountAddress,
  transactionManager: { startTransaction: vi.fn(() => 'tx-bundle') },
  waitForTransaction: vi.fn(async () => ({ hash: '0xhash' })),
}))
vi.mock('@/features/migration/service/ensureOwnedPermRes', () => ({
  buildDeployOwnedPermResCall: vi.fn(() => DEPLOY_CALL),
  findExistingPermRes: vi.fn(),
  simulateOwnedPermResAddress: vi.fn(async () => RESOLVER),
}))
vi.mock('./changeResolver', () => ({
  buildSetResolverCall: vi.fn(() => SET_RESOLVER_CALL),
}))
vi.mock('./profileRecordTransactions', () => ({
  buildRecordsUpdateCalls: vi.fn(async () => ({
    calls: RECORD_CALLS,
    description: 'records',
  })),
}))

import {
  type RhinestoneSigner,
  transactionManager,
} from '@ens-apps/transaction-manager'
import {
  buildDeployOwnedPermResCall,
  findExistingPermRes,
} from '@/features/migration/service/ensureOwnedPermRes'
import { buildRecordsUpdateCalls } from './profileRecordTransactions'
import { setupControlledResolver } from './setupControlledResolver'

const SMART_ACCOUNT = '0x2222222222222222222222222222222222222222' as Address
const OWNER = '0x1111111111111111111111111111111111111111' as Address
const RESOLVER = '0x3333333333333333333333333333333333333333' as Address
const DEPLOY_CALL = {
  to: '0x00000000000000000000000000000000000000a1' as Address,
  data: '0xdeploy' as const,
  value: 0n,
}
const SET_RESOLVER_CALL = {
  to: '0x00000000000000000000000000000000000000a2' as Address,
  data: '0xsetresolver' as const,
  value: 0n,
}
const RECORD_CALLS = [{ to: RESOLVER, data: '0xrecord' as const, value: 0n }]
const CHAIN_ID = 11155111
const publicClient = {} as PublicClient

const smartSigner: RhinestoneSigner = {
  type: 'rhinestone',
  account: {} as never,
  config: { accountAddress: SMART_ACCOUNT, rhinestoneApiKey: 'k' },
}

const snapshots = {
  before: { texts: [], coins: [] },
  after: { texts: [], coins: [{ coinType: 60, value: SMART_ACCOUNT }] },
}

const start = vi.mocked(transactionManager.startTransaction)
const mockedFindExisting = vi.mocked(findExistingPermRes)
const mockedDeployCall = vi.mocked(buildDeployOwnedPermResCall)
const mockedBuildRecords = vi.mocked(buildRecordsUpdateCalls)

afterEach(() => {
  vi.clearAllMocks()
})

describe('setupControlledResolver', () => {
  it('bundles deploy + setResolver + records into one user-paid intent', async () => {
    mockedFindExisting.mockResolvedValue(null)

    const resolver = await setupControlledResolver({
      name: 'leon.eth',
      signer: smartSigner,
      ownerAddress: OWNER,
      publicClient,
      chainId: CHAIN_ID,
      ...snapshots,
    })

    expect(resolver).toBe(RESOLVER)
    expect(mockedFindExisting).toHaveBeenCalledWith({
      eoa: OWNER,
      deployer: SMART_ACCOUNT,
      publicClient,
    })
    expect(mockedDeployCall).toHaveBeenCalledWith(OWNER)
    expect(start).toHaveBeenCalledTimes(1)
    const [intent] = start.mock.calls[0] ?? []
    expect(intent).toEqual({
      type: 'custom',
      request: {
        type: 'rhinestone-intent',
        from: SMART_ACCOUNT,
        chainId: CHAIN_ID,
        rhinestoneParams: {
          calls: [DEPLOY_CALL, SET_RESOLVER_CALL, ...RECORD_CALLS],
          feeAsset: 'USDC',
        },
      },
    })
  })

  it('omits the deploy call when the owned resolver already exists', async () => {
    mockedFindExisting.mockResolvedValue(RESOLVER)

    await setupControlledResolver({
      name: 'leon.eth',
      signer: smartSigner,
      ownerAddress: OWNER,
      publicClient,
      chainId: CHAIN_ID,
      ...snapshots,
    })

    expect(mockedDeployCall).not.toHaveBeenCalled()
    const [intent] = start.mock.calls[0] ?? []
    const calls = (
      intent as unknown as {
        request: { rhinestoneParams: { calls: unknown[] } }
      }
    ).request.rhinestoneParams.calls
    expect(calls).toEqual([SET_RESOLVER_CALL, ...RECORD_CALLS])
  })

  it('omits the record write when both snapshots are empty', async () => {
    mockedFindExisting.mockResolvedValue(null)

    await setupControlledResolver({
      name: 'leon.eth',
      signer: smartSigner,
      ownerAddress: OWNER,
      publicClient,
      chainId: CHAIN_ID,
      before: { texts: [], coins: [] },
      after: { texts: [], coins: [] },
    })

    expect(mockedBuildRecords).not.toHaveBeenCalled()
    const [intent] = start.mock.calls[0] ?? []
    const calls = (
      intent as unknown as {
        request: { rhinestoneParams: { calls: unknown[] } }
      }
    ).request.rhinestoneParams.calls
    expect(calls).toEqual([DEPLOY_CALL, SET_RESOLVER_CALL])
  })

  it('rejects subnames before doing any on-chain work', async () => {
    await expect(
      setupControlledResolver({
        name: 'sub.leon.eth',
        signer: smartSigner,
        ownerAddress: OWNER,
        publicClient,
        chainId: CHAIN_ID,
        ...snapshots,
      }),
    ).rejects.toThrow(/subname/i)

    expect(start).not.toHaveBeenCalled()
    expect(mockedFindExisting).not.toHaveBeenCalled()
  })
})
