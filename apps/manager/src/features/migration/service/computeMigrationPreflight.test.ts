import type { Config as WagmiConfig } from '@wagmi/core'
import { err, ok, type Result } from 'neverthrow'
import type { Address, PublicClient } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OWNER as EOA,
  makeDomain,
  DEFAULT_RESOLVER as RESOLVER,
} from './_fixtures'
import { FUSES } from './classifyNames'
import { computeMigrationPreflight } from './computeMigrationPreflight'
import { ProfileFetchError } from './fetchV1Profiles'
import {
  checkMigrationApprovals,
  type MigrationApprovalStatus,
} from './migrationApprovals'
import {
  assertLockedPublicResolverSetMembership,
  assertMigrationHelperRuntimeCode,
  assertRequiredMigrationContractCode,
  checkDeterministicMigrationResolverReadiness,
  checkMigrationHcaReadiness,
  getMigrationResolverAddress,
} from './migrationInvariants'
import { getV1ProfileKeys } from './v1SubgraphClient'

vi.mock('./v1SubgraphClient', async (importActual) => ({
  ...(await importActual<typeof import('./v1SubgraphClient')>()),
  getV1ProfileKeys: vi.fn(),
}))
vi.mock('./migrationApprovals', async (importActual) => ({
  ...(await importActual<typeof import('./migrationApprovals')>()),
  checkMigrationApprovals: vi.fn(),
}))
vi.mock('./migrationInvariants', async (importActual) => ({
  ...(await importActual<typeof import('./migrationInvariants')>()),
  assertLockedPublicResolverSetMembership: vi.fn(),
  assertMigrationHelperRuntimeCode: vi.fn(),
  assertRequiredMigrationContractCode: vi.fn(),
  checkMigrationHcaReadiness: vi.fn(),
  checkDeterministicMigrationResolverReadiness: vi.fn(),
  getMigrationResolverAddress: vi.fn(
    () => '0x00000000000000000000000000000000000000ce',
  ),
}))

const getV1ProfileKeysMock = vi.mocked(getV1ProfileKeys)
const checkMigrationApprovalsMock = vi.mocked(checkMigrationApprovals)
const checkResolverReadinessMock = vi.mocked(
  checkDeterministicMigrationResolverReadiness,
)
const assertRequiredMigrationContractCodeMock = vi.mocked(
  assertRequiredMigrationContractCode,
)
const assertMigrationHelperRuntimeCodeMock = vi.mocked(
  assertMigrationHelperRuntimeCode,
)
const assertLockedPublicResolverSetMembershipMock = vi.mocked(
  assertLockedPublicResolverSetMembership,
)
const checkMigrationHcaReadinessMock = vi.mocked(checkMigrationHcaReadiness)
const getMigrationResolverAddressMock = vi.mocked(getMigrationResolverAddress)

const HCA: Address = '0x00000000000000000000000000000000000000ca'
const HCA_RESOLVER: Address = '0x00000000000000000000000000000000000000ce'
const KNOWN_PUBLIC_RESOLVER: Address =
  '0x640294a2b2d87e7f522db3e3e3e876764bce170d'

const ALL_HCA_APPROVED: MigrationApprovalStatus = {
  baseRegistrarHcaApproved: true,
  unwrappedTokenApprovals: [],
  nameWrapperHcaApproved: true,
  ethRegistryHcaApproved: true,
}

const run = (
  opts: {
    domain?: Parameters<typeof makeDomain>[0]
    profileKeys?: Result<unknown, unknown>
    hcaAddress?: Address
    hcaApprovals?: MigrationApprovalStatus
  } = {},
) => {
  if (opts.hcaAddress) {
    checkMigrationApprovalsMock.mockResolvedValueOnce(
      opts.hcaApprovals ?? ALL_HCA_APPROVED,
    )
    assertRequiredMigrationContractCodeMock.mockResolvedValueOnce()
    assertMigrationHelperRuntimeCodeMock.mockResolvedValueOnce()
    checkMigrationHcaReadinessMock.mockResolvedValueOnce({
      status: 'deployment-required',
      hca: opts.hcaAddress,
    })
  }
  if (opts.profileKeys !== undefined) {
    getV1ProfileKeysMock.mockReturnValueOnce(opts.profileKeys as never)
  }
  return computeMigrationPreflight({
    eoa: EOA,
    hcaAddress: opts.hcaAddress,
    domains: [makeDomain({ resolverAddress: RESOLVER, ...opts.domain })],
    wagmiConfig: {} as WagmiConfig,
    publicClient: {} as PublicClient,
  })
}

beforeEach(() => {
  getV1ProfileKeysMock.mockReset()
  checkMigrationApprovalsMock.mockReset()
  checkResolverReadinessMock.mockReset()
  assertRequiredMigrationContractCodeMock.mockReset()
  assertMigrationHelperRuntimeCodeMock.mockReset()
  assertLockedPublicResolverSetMembershipMock.mockReset()
  checkMigrationHcaReadinessMock.mockReset()
  getMigrationResolverAddressMock.mockClear()
})

describe('computeMigrationPreflight — preExistingOwnedPermRes', () => {
  it('does not adopt an EOA-owned resolver for HCA-batched migration', async () => {
    const result = await run()
    expect(result.preExistingOwnedPermRes).toBeNull()
  })
})

describe('computeMigrationPreflight — skipApprovalPhase', () => {
  it('cannot skip direct-HCA permission checks before the HCA is known', async () => {
    const result = await run()
    expect(result.skipApprovalPhase).toBe(false)
  })

  it('skips permissions when the existing HCA is already an operator', async () => {
    const result = await run({ hcaAddress: HCA })
    expect(result.skipApprovalPhase).toBe(true)
  })
})

describe('computeMigrationPreflight — HCA approvals', () => {
  it('plans a token approval and manager approval when missing', async () => {
    const result = await run({
      domain: {
        isWrapped: false,
        ownerId: '0x00000000000000000000000000000000000000aa',
      },
      hcaAddress: HCA,
      hcaApprovals: {
        ...ALL_HCA_APPROVED,
        baseRegistrarHcaApproved: false,
        unwrappedTokenApprovals: [],
        ethRegistryHcaApproved: false,
      },
    })

    expect(result.requiresManagerRestoration).toBe(true)
    expect(result.skipApprovalPhase).toBe(false)
    expect(result.migrationApprovals?.map((approval) => approval.id)).toEqual([
      'base-registrar:hca-token',
      'eth-registry:hca',
    ])
    expect(checkMigrationApprovalsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eoa: EOA,
        hcaAddress: HCA,
        needs: expect.objectContaining({ requiresManagerRestoration: true }),
      }),
    )
    expect(assertRequiredMigrationContractCodeMock).toHaveBeenCalledOnce()
    expect(assertMigrationHelperRuntimeCodeMock).toHaveBeenCalledWith({
      publicClient: expect.anything(),
    })
    expect(assertLockedPublicResolverSetMembershipMock).toHaveBeenCalledWith({
      publicClient: expect.anything(),
      names: expect.any(Array),
    })
    expect(checkMigrationHcaReadinessMock).toHaveBeenCalledWith(
      expect.objectContaining({ hca: HCA, expectedOwner: EOA }),
    )
  })

  it('checks locked known resolvers against the pinned PublicResolverSet', async () => {
    const publicClient = {} as PublicClient
    checkMigrationApprovalsMock.mockResolvedValueOnce(ALL_HCA_APPROVED)
    assertRequiredMigrationContractCodeMock.mockResolvedValueOnce()
    assertMigrationHelperRuntimeCodeMock.mockResolvedValueOnce()
    assertLockedPublicResolverSetMembershipMock.mockResolvedValueOnce()
    checkMigrationHcaReadinessMock.mockResolvedValueOnce({
      status: 'deployment-required',
      hca: HCA,
    })

    await computeMigrationPreflight({
      eoa: EOA,
      hcaAddress: HCA,
      domains: [
        makeDomain({
          isWrapped: true,
          fuses: FUSES.CANNOT_UNWRAP | FUSES.CANNOT_SET_RESOLVER,
          resolverAddress: '0x640294a2b2d87e7f522db3e3e3e876764bce170d',
        }),
      ],
      wagmiConfig: {} as WagmiConfig,
      publicClient,
    })

    expect(assertLockedPublicResolverSetMembershipMock).toHaveBeenCalledWith({
      publicClient,
      names: [
        expect.objectContaining({
          tokenType: 'locked-2ld',
          resolverStrategy: 'keep-v1',
          v1ResolverAddress: '0x640294a2b2d87e7f522db3e3e3e876764bce170d',
        }),
      ],
    })
  })

  it('derives the HCA resolver and never log-scans for an EOA resolver', async () => {
    checkResolverReadinessMock.mockResolvedValueOnce({
      status: 'deployment-required',
      resolver: HCA_RESOLVER,
    })
    const result = await run({
      domain: { resolverAddress: null },
      hcaAddress: HCA,
      profileKeys: ok([]),
    })

    expect(getMigrationResolverAddress).toHaveBeenCalledWith(HCA)
    expect(checkResolverReadinessMock).toHaveBeenCalledWith(
      expect.objectContaining({ hca: HCA, wallet: EOA }),
    )
    expect(result.preExistingOwnedPermRes).toBeNull()
    expect(result.hcaResolverAddress).toBe(HCA_RESOLVER)
    expect(result.hcaResolverReadiness).toEqual({
      status: 'deployment-required',
      resolver: HCA_RESOLVER,
    })
  })
})

describe('computeMigrationPreflight — skipFetchProfilesPhase', () => {
  it('is true when no name routes to owned-permres', async () => {
    const result = await run()
    expect(result.skipFetchProfilesPhase).toBe(true)
    expect(getV1ProfileKeysMock).not.toHaveBeenCalled()
  })

  it('is true when all profile keys are empty', async () => {
    const result = await run({
      domain: { resolverAddress: KNOWN_PUBLIC_RESOLVER },
      profileKeys: ok([
        {
          id: '0xabc',
          texts: [],
          coinTypes: [],
          contentHash: null,
          abiContentTypes: [],
        },
      ]),
    })
    expect(result.skipFetchProfilesPhase).toBe(true)
  })

  it('is false when any profile has at least one text or coin type', async () => {
    const result = await run({
      domain: { resolverAddress: KNOWN_PUBLIC_RESOLVER },
      profileKeys: ok([
        {
          id: '0xabc',
          texts: ['email'],
          coinTypes: [],
          contentHash: null,
          abiContentTypes: [],
        },
      ]),
    })
    expect(result.skipFetchProfilesPhase).toBe(false)
  })

  it.each([
    ['contenthash', { contentHash: '0xe301', abiContentTypes: [] }],
    ['ABI', { contentHash: null, abiContentTypes: [1n] }],
  ])('is false when the profile only has a %s record', async (_, records) => {
    const result = await run({
      domain: { resolverAddress: KNOWN_PUBLIC_RESOLVER },
      profileKeys: ok([
        {
          id: '0xabc',
          texts: [],
          coinTypes: [],
          ...records,
        },
      ]),
    })
    expect(result.skipFetchProfilesPhase).toBe(false)
  })

  it('defaults to false when the subgraph query returns an Err', async () => {
    const result = await run({
      domain: { resolverAddress: KNOWN_PUBLIC_RESOLVER },
      profileKeys: err(new Error('subgraph down')),
    })
    expect(result.skipFetchProfilesPhase).toBe(false)
  })

  it('fails closed when a successful inventory omits a resolver-backed node', async () => {
    await expect(
      run({
        domain: { resolverAddress: KNOWN_PUBLIC_RESOLVER },
        profileKeys: ok([]),
      }),
    ).rejects.toBeInstanceOf(ProfileFetchError)
  })
})
