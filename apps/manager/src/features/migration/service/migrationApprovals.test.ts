import type { Config as WagmiConfig } from '@wagmi/core'
import { readContracts } from '@wagmi/core'
import { type Address, decodeFunctionData, erc721Abi } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OPERATOR_APPROVAL_ABI } from '../contracts/abis'
import { V1_CONTRACTS, V2_CONTRACTS } from '../contracts/addresses'
import {
  buildMigrationApprovalCall,
  buildMigrationOperatorApprovalRevocationCall,
  checkMigrationApprovals,
  type MigrationApprovalStatus,
  migrationApprovalForId,
  planMigrationApprovals,
} from './migrationApprovals'

vi.mock('@wagmi/core', () => ({
  readContracts: vi.fn(),
}))

const readContractsMock = vi.mocked(readContracts)
const EOA: Address = '0x0000000000000000000000000000000000000001'
const HCA: Address = '0x0000000000000000000000000000000000000003'
const OTHER: Address = '0x0000000000000000000000000000000000000004'
const WAGMI = {} as WagmiConfig
const TOKEN_ONE = 1n
const TOKEN_TWO = 2n
const TOKEN_THREE = 3n

const statusFor = (
  tokenIds: readonly bigint[],
  overrides: Partial<MigrationApprovalStatus> = {},
): MigrationApprovalStatus => ({
  baseRegistrarHcaApproved: false,
  unwrappedTokenApprovals: tokenIds.map((tokenId) => ({
    tokenId,
    approved: false,
  })),
  nameWrapperHcaApproved: false,
  ethRegistryHcaApproved: false,
  ...overrides,
})

beforeEach(() => {
  readContractsMock.mockReset()
})

describe('checkMigrationApprovals', () => {
  it('skips reads and treats irrelevant permissions as satisfied', async () => {
    await expect(
      checkMigrationApprovals({
        eoa: EOA,
        hcaAddress: HCA,
        needs: {
          hasUnwrapped: false,
          unwrappedTokenIds: [],
          hasWrapped: false,
          requiresManagerRestoration: false,
        },
        wagmiConfig: WAGMI,
      }),
    ).resolves.toEqual({
      baseRegistrarHcaApproved: true,
      unwrappedTokenApprovals: [],
      nameWrapperHcaApproved: true,
      ethRegistryHcaApproved: true,
    })
    expect(readContractsMock).not.toHaveBeenCalled()
  })

  it('checks helper NFT approvals and the HCA manager approval in one batch', async () => {
    readContractsMock.mockResolvedValueOnce([
      false,
      V2_CONTRACTS.MigrationHelper,
      OTHER,
      true,
      false,
    ] as never)

    await expect(
      checkMigrationApprovals({
        eoa: EOA,
        hcaAddress: HCA,
        needs: {
          hasUnwrapped: true,
          unwrappedTokenIds: [TOKEN_ONE, TOKEN_TWO],
          hasWrapped: true,
          requiresManagerRestoration: true,
        },
        wagmiConfig: WAGMI,
      }),
    ).resolves.toEqual({
      baseRegistrarHcaApproved: false,
      unwrappedTokenApprovals: [
        { tokenId: TOKEN_ONE, approved: true },
        { tokenId: TOKEN_TWO, approved: false },
      ],
      nameWrapperHcaApproved: true,
      ethRegistryHcaApproved: false,
    })

    const options = readContractsMock.mock.calls[0]?.[1] as unknown as {
      contracts: readonly {
        readonly address: Address
        readonly args: readonly unknown[]
        readonly functionName: string
      }[]
    }
    expect(options.contracts).toMatchObject([
      {
        address: V1_CONTRACTS.BaseRegistrar,
        args: [EOA, V2_CONTRACTS.MigrationHelper],
        functionName: 'isApprovedForAll',
      },
      {
        address: V1_CONTRACTS.BaseRegistrar,
        args: [TOKEN_ONE],
        functionName: 'getApproved',
      },
      {
        address: V1_CONTRACTS.BaseRegistrar,
        args: [TOKEN_TWO],
        functionName: 'getApproved',
      },
      {
        address: V1_CONTRACTS.NameWrapper,
        args: [EOA, V2_CONTRACTS.MigrationHelper],
        functionName: 'isApprovedForAll',
      },
      {
        address: V2_CONTRACTS.ETHRegistry,
        args: [EOA, HCA],
        functionName: 'isApprovedForAll',
      },
    ])
    expect(options.contracts.at(-1)).toMatchObject({
      address: V2_CONTRACTS.ETHRegistry,
      args: [EOA, HCA],
    })
  })
})

describe('planMigrationApprovals', () => {
  const needsFor = (unwrappedTokenIds: readonly bigint[]) => ({
    hasUnwrapped: unwrappedTokenIds.length > 0,
    unwrappedTokenIds,
    hasWrapped: false,
    requiresManagerRestoration: false,
  })

  it('uses per-token approval for one missing registration', () => {
    const oneTokenPlan = planMigrationApprovals({
      hcaAddress: HCA,
      needs: needsFor([TOKEN_ONE]),
      status: statusFor([TOKEN_ONE]),
    })
    expect(oneTokenPlan).toMatchObject([
      { kind: 'erc721-token', tokenId: TOKEN_ONE },
    ])
  })

  it('uses one operator approval when two registrations are missing', () => {
    expect(
      planMigrationApprovals({
        hcaAddress: HCA,
        needs: needsFor([TOKEN_ONE, TOKEN_TWO]),
        status: statusFor([TOKEN_ONE, TOKEN_TWO]),
      }),
    ).toMatchObject([{ kind: 'operator', id: 'base-registrar:hca' }])
  })

  it('counts only missing token approvals when selecting the strategy', () => {
    expect(
      planMigrationApprovals({
        hcaAddress: HCA,
        needs: needsFor([TOKEN_ONE, TOKEN_TWO, TOKEN_THREE]),
        status: statusFor([TOKEN_ONE, TOKEN_TWO, TOKEN_THREE], {
          unwrappedTokenApprovals: [
            { tokenId: TOKEN_ONE, approved: true },
            { tokenId: TOKEN_TWO, approved: false },
            { tokenId: TOKEN_THREE, approved: false },
          ],
        }),
      }),
    ).toMatchObject([{ kind: 'operator', id: 'base-registrar:hca' }])
  })

  it('omits registration grants when every token is already approved', () => {
    expect(
      planMigrationApprovals({
        hcaAddress: HCA,
        needs: needsFor([TOKEN_ONE, TOKEN_TWO]),
        status: statusFor([TOKEN_ONE, TOKEN_TWO], {
          unwrappedTokenApprovals: [
            { tokenId: TOKEN_ONE, approved: true },
            { tokenId: TOKEN_TWO, approved: true },
          ],
        }),
      }),
    ).toEqual([])
  })

  it('omits all registration grants when the helper is already an operator', () => {
    expect(
      planMigrationApprovals({
        hcaAddress: HCA,
        needs: needsFor([TOKEN_ONE, TOKEN_TWO, TOKEN_THREE]),
        status: statusFor([TOKEN_ONE, TOKEN_TWO, TOKEN_THREE], {
          baseRegistrarHcaApproved: true,
        }),
      }),
    ).toEqual([])
  })

  it('adds only missing wrapped-name and manager HCA operators', () => {
    expect(
      planMigrationApprovals({
        hcaAddress: HCA,
        needs: {
          hasUnwrapped: false,
          unwrappedTokenIds: [],
          hasWrapped: true,
          requiresManagerRestoration: true,
        },
        status: statusFor([], { nameWrapperHcaApproved: true }),
      }).map((approval) => approval.id),
    ).toEqual(['eth-registry:hca'])
  })
})

describe('approval calldata', () => {
  it('encodes ERC-721 approval for MigrationHelper', () => {
    const approval = migrationApprovalForId({
      id: 'base-registrar:hca-token',
      hcaAddress: HCA,
      tokenId: TOKEN_ONE,
    })
    const grant = decodeFunctionData({
      abi: erc721Abi,
      data: buildMigrationApprovalCall(approval).data,
    })
    expect(grant.functionName).toBe('approve')
    expect(grant.args).toEqual([V2_CONTRACTS.MigrationHelper, TOKEN_ONE])
  })

  it('encodes a persistent operator grant', () => {
    const approval = migrationApprovalForId({
      id: 'name-wrapper:hca',
      hcaAddress: HCA,
    })
    if (approval.kind !== 'operator') throw new Error('Expected operator')
    const decoded = decodeFunctionData({
      abi: OPERATOR_APPROVAL_ABI,
      data: buildMigrationApprovalCall(approval).data,
    })
    expect(decoded.args).toEqual([V2_CONTRACTS.MigrationHelper, true])
  })

  it('encodes operator revocation after migration', () => {
    const approval = migrationApprovalForId({
      id: 'name-wrapper:hca',
      hcaAddress: HCA,
    })
    if (approval.kind !== 'operator') throw new Error('Expected operator')
    const decoded = decodeFunctionData({
      abi: OPERATOR_APPROVAL_ABI,
      data: buildMigrationOperatorApprovalRevocationCall(approval).data,
    })
    expect(decoded.args).toEqual([V2_CONTRACTS.MigrationHelper, false])
  })
})
