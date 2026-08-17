/**
 * Tests for initializeRhinestoneAccount (standalone HCA).
 *
 * Covers: standalone account-config construction (single ECDSA owner +
 * experimental_sessions on the validator, userSalt 0n, no initData on fresh
 * create), lazy deploy (NO deploy transaction at init), and adopt-existing
 * verification (owner/accountId/implementation match → recreate with initData;
 * any mismatch → tagged AccountVerificationError, never a different HCA).
 */

// biome-ignore-all lint/suspicious/noExplicitAny: Test mocks require flexible typing

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateAccount = vi.fn()

vi.mock('@rhinestone/sdk', () => ({
  RhinestoneSDK: vi.fn(function (this: any) {
    this.createAccount = mockCreateAccount
    return this
  }),
}))

import { RhinestoneSDK } from '@rhinestone/sdk'
import {
  type Account,
  type Address,
  type Chain,
  encodeFunctionData,
  parseAbi,
} from 'viem'
import { sepolia } from 'viem/chains'
import {
  buildHcaDeploymentCall,
  computeStandaloneHcaAddress,
  getHcaDirectExecutionReadiness,
  initializeRhinestoneAccount,
} from './initialize-account'
import {
  getDestinationContracts,
  ONCHAIN_ACCOUNT_ID,
  STANDALONE_HCA_VERSION,
} from './manifest'

const OWNER = '0x2222222222222222222222222222222222222222' as Address
const OTHER = '0x9999999999999999999999999999999999999999' as Address
const CHAIN = sepolia as Chain
const CONTRACTS = getDestinationContracts(sepolia.id)
const MOCK_HCA = computeStandaloneHcaAddress({
  chainId: sepolia.id,
  owner: OWNER,
})
const hcaFactoryDeployAbi = parseAbi([
  'function deploy(address owner, address hcaImplementation, uint256 userSalt) returns (address hca)',
])
const deploymentData = (
  params: {
    readonly owner?: Address
    readonly implementation?: Address
    readonly userSalt?: bigint
  } = {},
) =>
  encodeFunctionData({
    abi: hcaFactoryDeployAbi,
    functionName: 'deploy',
    args: [
      params.owner ?? OWNER,
      params.implementation ?? CONTRACTS.standaloneHcaImplementation,
      params.userSalt ?? 0n,
    ],
  })
const DEPLOY_DATA = deploymentData()
const mockGetInitData = vi.fn(() => ({
  factory: CONTRACTS.standaloneHcaFactory,
  factoryData: DEPLOY_DATA,
}))

describe('computeStandaloneHcaAddress', () => {
  it('preserves the pinned VerifiableFactory CREATE2 address', () => {
    expect(MOCK_HCA).toBe('0x29fBA8EAfc3a898B48a314182Ea5c93ce5734DBd')
  })
})

function makeOwnerAccount(): Account {
  return {
    address: OWNER,
    signMessage: vi.fn(),
    signTypedData: vi.fn(),
  } as unknown as Account
}

function makeSdkAccount() {
  return {
    getAddress: () => MOCK_HCA,
    getInitData: mockGetInitData,
  } as any
}

/** publicClient whose reads default to a valid existing HCA. */
function makePublicClient(overrides: Partial<Record<string, any>> = {}) {
  return {
    getCode: overrides.getCode ?? vi.fn().mockResolvedValue('0x'),
    readContract:
      overrides.readContract ??
      vi.fn().mockImplementation(({ functionName }: any) => {
        if (functionName === 'owner') return OWNER
        if (functionName === 'accountId') return ONCHAIN_ACCOUNT_ID
        if (functionName === 'authorizedOwnerOf') return OWNER
        if (functionName === 'verifyContract')
          return CONTRACTS.standaloneHcaImplementation
        return undefined
      }),
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetInitData.mockReturnValue({
    factory: CONTRACTS.standaloneHcaFactory,
    factoryData: DEPLOY_DATA,
  })
  mockCreateAccount.mockResolvedValue(makeSdkAccount())
})

describe('initializeRhinestoneAccount (fresh HCA)', () => {
  it('builds the standalone config with a single ECDSA owner + sessions; UNDEPLOYED → no initData (single instance)', async () => {
    const owner = makeOwnerAccount()
    const result = await initializeRhinestoneAccount({
      ownerAccount: owner,
      eoaAddress: OWNER,
      chain: CHAIN,
      publicClient: makePublicClient(), // getCode → '0x' (undeployed)
      rhinestoneApiKey: 'k',
    })

    expect(result.isOk()).toBe(true)
    // UNDEPLOYED HCA: ONE call with NO initData. The commit leg's setup-ops
    // must deploy the account, which requires the factory init code (absent
    // when initData is set). The same candidate instance is returned.
    expect(mockCreateAccount).toHaveBeenCalledTimes(1)

    const deriveCfg = mockCreateAccount.mock.calls[0][0]
    expect(deriveCfg.account).toMatchObject({
      type: 'hca',
      version: STANDALONE_HCA_VERSION,
      factory: CONTRACTS.standaloneHcaFactory,
      implementation: CONTRACTS.standaloneHcaImplementation,
      validator: CONTRACTS.hcaOwnerAndSessionValidator,
      userSalt: 0n,
    })
    expect(deriveCfg.owners).toMatchObject({ type: 'ecdsa', accounts: [owner] })
    expect(deriveCfg.experimental_sessions).toMatchObject({ enabled: true })
    expect(deriveCfg).not.toHaveProperty('initData')
  })

  it('ALREADY-DEPLOYED → binds via initData (second instance) so no re-deploy op is emitted', async () => {
    const owner = makeOwnerAccount()
    const result = await initializeRhinestoneAccount({
      ownerAccount: owner,
      eoaAddress: OWNER,
      chain: CHAIN,
      // getCode → non-empty (deployed); reads default to a valid existing HCA.
      publicClient: makePublicClient({
        getCode: vi.fn().mockResolvedValue('0xabcdef'),
      }),
      rhinestoneApiKey: 'k',
    })

    expect(result.isOk()).toBe(true)
    // DEPLOYED HCA: TWO calls — (1) derive the address with no initData, then
    // (2) bind via `initData: { address }` so setup-ops are empty (no
    // re-deploy → the session signature stays valid).
    expect(mockCreateAccount).toHaveBeenCalledTimes(2)
    expect(mockCreateAccount.mock.calls[0][0]).not.toHaveProperty('initData')
    expect(mockCreateAccount.mock.calls[1][0].initData).toMatchObject({
      address: MOCK_HCA,
    })
  })

  it('does not deploy at init (lazy deploy) and reports alreadyDeployed=false', async () => {
    const result = await initializeRhinestoneAccount({
      ownerAccount: makeOwnerAccount(),
      eoaAddress: OWNER,
      chain: CHAIN,
      publicClient: makePublicClient(),
      rhinestoneApiKey: 'k',
    })
    const value = result._unsafeUnwrap()
    expect(value.alreadyDeployed).toBe(false)
    expect(value.address).toBe(MOCK_HCA)
    expect(value.ownerAddress).toBe(OWNER)
  })

  it('errors (tagged) when rhinestoneApiKey is empty', async () => {
    const result = await initializeRhinestoneAccount({
      ownerAccount: makeOwnerAccount(),
      eoaAddress: OWNER,
      chain: CHAIN,
      publicClient: makePublicClient(),
      rhinestoneApiKey: '',
    })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()._tag).toBe('AccountInitError')
  })
})

describe('initializeRhinestoneAccount (adopt existing HCA)', () => {
  it('recreates with initData:{address} after verification passes', async () => {
    const publicClient = makePublicClient({
      getCode: vi.fn().mockResolvedValue('0xabcd'),
    })
    const result = await initializeRhinestoneAccount({
      ownerAccount: makeOwnerAccount(),
      eoaAddress: OWNER,
      chain: CHAIN,
      publicClient,
      rhinestoneApiKey: 'k',
    })
    expect(result._unsafeUnwrap().alreadyDeployed).toBe(true)
    // Second createAccount call carries initData.
    expect(mockCreateAccount).toHaveBeenCalledTimes(2)
    expect(mockCreateAccount.mock.calls[1][0]).toMatchObject({
      initData: { address: MOCK_HCA },
    })
  })

  it('rejects when the on-chain owner does not match (never adopts a different HCA)', async () => {
    const publicClient = makePublicClient({
      getCode: vi.fn().mockResolvedValue('0xabcd'),
      readContract: vi.fn().mockImplementation(({ functionName }: any) => {
        if (functionName === 'owner')
          return '0x9999999999999999999999999999999999999999'
        if (functionName === 'accountId') return ONCHAIN_ACCOUNT_ID
        if (functionName === 'authorizedOwnerOf') return OWNER
        if (functionName === 'verifyContract')
          return CONTRACTS.standaloneHcaImplementation
        return undefined
      }),
    })
    const result = await initializeRhinestoneAccount({
      ownerAccount: makeOwnerAccount(),
      eoaAddress: OWNER,
      chain: CHAIN,
      publicClient,
      rhinestoneApiKey: 'k',
    })
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error._tag).toBe('AccountVerificationError')
    expect((error as any).field).toBe('owner')
    // Did NOT recreate with initData.
    expect(mockCreateAccount).toHaveBeenCalledTimes(1)
  })

  it('rejects when accountId does not match', async () => {
    const publicClient = makePublicClient({
      getCode: vi.fn().mockResolvedValue('0xabcd'),
      readContract: vi.fn().mockImplementation(({ functionName }: any) => {
        if (functionName === 'owner') return OWNER
        if (functionName === 'accountId') return 'something-else'
        if (functionName === 'authorizedOwnerOf') return OWNER
        if (functionName === 'verifyContract')
          return CONTRACTS.standaloneHcaImplementation
        return undefined
      }),
    })
    const result = await initializeRhinestoneAccount({
      ownerAccount: makeOwnerAccount(),
      eoaAddress: OWNER,
      chain: CHAIN,
      publicClient,
      rhinestoneApiKey: 'k',
    })
    expect(result._unsafeUnwrapErr()._tag).toBe('AccountVerificationError')
    expect((result._unsafeUnwrapErr() as any).field).toBe('accountId')
  })

  it('rejects when the remediated factory did not authorize the connected owner', async () => {
    const publicClient = makePublicClient({
      getCode: vi.fn().mockResolvedValue('0xabcd'),
      readContract: vi.fn().mockImplementation(({ functionName }: any) => {
        if (functionName === 'owner') return OWNER
        if (functionName === 'accountId') return ONCHAIN_ACCOUNT_ID
        if (functionName === 'authorizedOwnerOf')
          return '0x9999999999999999999999999999999999999999'
        if (functionName === 'verifyContract')
          return CONTRACTS.standaloneHcaImplementation
        return undefined
      }),
    })
    const result = await initializeRhinestoneAccount({
      ownerAccount: makeOwnerAccount(),
      eoaAddress: OWNER,
      chain: CHAIN,
      publicClient,
      rhinestoneApiKey: 'k',
    })
    expect(result._unsafeUnwrapErr()._tag).toBe('AccountVerificationError')
    expect((result._unsafeUnwrapErr() as any).field).toBe('authorizedOwner')
  })
})

describe('direct owner execution readiness', () => {
  it('uses SDK getInitData to expose the factory deployment call', async () => {
    const initialized = (
      await initializeRhinestoneAccount({
        ownerAccount: makeOwnerAccount(),
        eoaAddress: OWNER,
        chain: CHAIN,
        publicClient: makePublicClient(),
        rhinestoneApiKey: 'k',
      })
    )._unsafeUnwrap()

    expect(getHcaDirectExecutionReadiness(initialized)).toEqual({
      status: 'deployment-required',
      hca: MOCK_HCA,
      deploymentCall: {
        to: CONTRACTS.standaloneHcaFactory,
        value: 0n,
        data: DEPLOY_DATA,
      },
    })
    expect(mockGetInitData).toHaveBeenCalledTimes(1)
  })

  it('does not request factory init data for an already-deployed HCA', async () => {
    const initialized = (
      await initializeRhinestoneAccount({
        ownerAccount: makeOwnerAccount(),
        eoaAddress: OWNER,
        chain: CHAIN,
        publicClient: makePublicClient({
          getCode: vi.fn().mockResolvedValue('0xabcd'),
        }),
        rhinestoneApiKey: 'k',
      })
    )._unsafeUnwrap()

    expect(getHcaDirectExecutionReadiness(initialized)).toEqual({
      status: 'ready',
      hca: MOCK_HCA,
    })
    expect(mockGetInitData).not.toHaveBeenCalled()
  })

  it.each([
    {
      field: 'factory',
      client: {
        getAddress: () => MOCK_HCA,
        getInitData: () => ({ factory: OTHER, factoryData: DEPLOY_DATA }),
      },
      expectedHca: MOCK_HCA,
    },
    {
      field: 'clientHca',
      client: {
        getAddress: () => OTHER,
        getInitData: () => ({
          factory: CONTRACTS.standaloneHcaFactory,
          factoryData: DEPLOY_DATA,
        }),
      },
      expectedHca: MOCK_HCA,
    },
    {
      field: 'calldata',
      client: {
        getAddress: () => MOCK_HCA,
        getInitData: () => ({
          factory: CONTRACTS.standaloneHcaFactory,
          factoryData: '0x1234' as const,
        }),
      },
      expectedHca: MOCK_HCA,
    },
    {
      field: 'owner',
      client: {
        getAddress: () => MOCK_HCA,
        getInitData: () => ({
          factory: CONTRACTS.standaloneHcaFactory,
          factoryData: deploymentData({ owner: OTHER }),
        }),
      },
      expectedHca: MOCK_HCA,
    },
    {
      field: 'implementation',
      client: {
        getAddress: () => MOCK_HCA,
        getInitData: () => ({
          factory: CONTRACTS.standaloneHcaFactory,
          factoryData: deploymentData({ implementation: OTHER }),
        }),
      },
      expectedHca: MOCK_HCA,
    },
    {
      field: 'userSalt',
      client: {
        getAddress: () => MOCK_HCA,
        getInitData: () => ({
          factory: CONTRACTS.standaloneHcaFactory,
          factoryData: deploymentData({ userSalt: 1n }),
        }),
      },
      expectedHca: MOCK_HCA,
    },
    {
      field: 'derivedHca',
      client: {
        getAddress: () => OTHER,
        getInitData: () => ({
          factory: CONTRACTS.standaloneHcaFactory,
          factoryData: DEPLOY_DATA,
        }),
      },
      expectedHca: OTHER,
    },
  ])('rejects a mismatched $field before returning a wallet call', ({
    client,
    expectedHca,
    field,
  }) => {
    expect(() =>
      buildHcaDeploymentCall({
        client,
        chainId: sepolia.id,
        expectedHca,
        expectedOwner: OWNER,
      }),
    ).toThrowError(
      expect.objectContaining({
        name: 'HcaDeploymentCallValidationError',
        field,
      }),
    )
  })

  it('refreshes after direct deployment and returns an initData-bound client', async () => {
    const publicClient = makePublicClient({
      getCode: vi.fn().mockResolvedValueOnce('0x').mockResolvedValue('0xabcd'),
    })
    const initial = (
      await initializeRhinestoneAccount({
        ownerAccount: makeOwnerAccount(),
        eoaAddress: OWNER,
        chain: CHAIN,
        publicClient,
        rhinestoneApiKey: 'k',
      })
    )._unsafeUnwrap()
    expect(initial.alreadyDeployed).toBe(false)

    const refreshed = (await initial.refresh())._unsafeUnwrap()
    expect(refreshed.alreadyDeployed).toBe(true)
    expect(mockCreateAccount).toHaveBeenCalledTimes(3)
    expect(mockCreateAccount.mock.calls[2][0]).toMatchObject({
      initData: { address: MOCK_HCA },
    })
  })
})

describe('SDK options', () => {
  it('passes apiKey via auth and never configures an ERC-4337 bundler', async () => {
    await initializeRhinestoneAccount({
      ownerAccount: makeOwnerAccount(),
      eoaAddress: OWNER,
      chain: CHAIN,
      publicClient: makePublicClient(),
      rhinestoneApiKey: 'test-api-key',
    })
    const opts = vi.mocked(RhinestoneSDK).mock.calls[0]?.[0] as any
    expect(opts.auth).toMatchObject({ mode: 'apiKey', apiKey: 'test-api-key' })
    expect(opts).not.toHaveProperty('bundler')
  })

  it('forwards endpointUrl and custom rpc urls when provided', async () => {
    await initializeRhinestoneAccount({
      ownerAccount: makeOwnerAccount(),
      eoaAddress: OWNER,
      chain: CHAIN,
      publicClient: makePublicClient(),
      rhinestoneApiKey: 'k',
      rhinestoneEndpointUrl: '/orchestrator',
      rhinestoneCustomRpcUrls: { 31337: 'http://127.0.0.1:8545' },
    })
    const opts = vi.mocked(RhinestoneSDK).mock.calls[0]?.[0] as any
    expect(opts.endpointUrl).toBe('/orchestrator')
    expect(opts.provider.urls[31337]).toBe('http://127.0.0.1:8545')
  })
})
