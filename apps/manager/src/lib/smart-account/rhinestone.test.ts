/**
 * Standalone-HCA account initialization tests (manager wrapper).
 *
 * Tests the manager-side `initializeRhinestoneAccount` wrapper: owner
 * resolution from the connected external wallet, env-derived SDK options
 * (auth-mode apiKey, custom provider, no bundler), and lazy-deploy
 * (`alreadyDeployed: false`). The `@rhinestone/sdk` is mocked; the
 * `@ens-apps/smart-account` package runs for real against the mocked SDK.
 */

// biome-ignore-all lint/suspicious/noExplicitAny: Test mocks require flexible typing
import { i18n } from '@lingui/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_RHINESTONE_API_KEY', 'test-rhinestone-key')

const { MOCK_OWNER_ADDRESS, MOCK_SMART_ACCOUNT_ADDRESS } = vi.hoisted(() => ({
  MOCK_OWNER_ADDRESS: '0x2222222222222222222222222222222222222222' as const,
  MOCK_SMART_ACCOUNT_ADDRESS:
    '0x1111111111111111111111111111111111111111' as const,
}))

const mockCreateAccount = vi.hoisted(() => vi.fn())

vi.mock(import('@rhinestone/sdk'), () => ({
  RhinestoneSDK: vi.fn(function (this: any) {
    this.createAccount = mockCreateAccount
    return this
  }),
  walletClientToAccount: vi.fn().mockReturnValue({
    address: MOCK_OWNER_ADDRESS,
    signMessage: vi.fn(),
    signTypedData: vi.fn(),
  }),
}))

vi.mock('@/lib/wagmi', () => ({
  customSepolia: {
    id: 11155111,
    name: 'Sepolia',
    rpcUrls: { default: { http: ['https://sepolia.example/rpc'] } },
  },
}))

import { RhinestoneSDK, walletClientToAccount } from '@rhinestone/sdk'
import type { PublicClient } from 'viem'
import {
  initializeRhinestoneAccount,
  type RhinestoneConfig,
} from './rhinestone'

type WalletClientParam = Parameters<
  typeof initializeRhinestoneAccount
>[0]['walletClient']

const mockWalletClient = {
  account: { address: MOCK_OWNER_ADDRESS as `0x${string}` },
  signMessage: vi.fn(),
  signTypedData: vi.fn(),
} as unknown as WalletClientParam

// Fresh HCA (no code) by default.
const mockPublicClient = {
  getCode: vi.fn().mockResolvedValue('0x'),
  readContract: vi.fn(),
} as unknown as PublicClient

describe('initializeRhinestoneAccount (standalone HCA)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    i18n.loadAndActivate({ locale: 'en', messages: {} })
    vi.stubEnv('VITE_RHINESTONE_API_KEY', 'test-rhinestone-key')
    mockCreateAccount.mockResolvedValue({
      getAddress: () => MOCK_SMART_ACCOUNT_ADDRESS,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates a standalone HCA (single ECDSA owner + sessions, lazy deploy)', async () => {
    const result = await initializeRhinestoneAccount({
      walletClient: mockWalletClient,
      publicClient: mockPublicClient,
    })

    expect(result.client).toBeDefined()
    expect(result.address).toBe(MOCK_SMART_ACCOUNT_ADDRESS)
    expect(result.ownerAddress).toBe(MOCK_OWNER_ADDRESS)
    expect(result.alreadyDeployed).toBe(false)
    expect(result.config.rhinestoneApiKey).toBe('test-rhinestone-key')

    const cfg = mockCreateAccount.mock.calls[0]?.[0]
    expect(cfg.account).toMatchObject({
      type: 'hca',
      version: 'ens-standalone-1.1.0',
      userSalt: 0n,
    })
    expect(cfg.owners).toMatchObject({ type: 'ecdsa' })
    expect(cfg.experimental_sessions).toMatchObject({ enabled: true })
    expect(cfg).not.toHaveProperty('initData')
  })

  it('configures the SDK with auth apiKey + custom provider, no bundler', async () => {
    await initializeRhinestoneAccount({
      walletClient: mockWalletClient,
      publicClient: mockPublicClient,
    })

    expect(walletClientToAccount).toHaveBeenCalledWith(mockWalletClient)

    const opts = vi.mocked(RhinestoneSDK).mock.calls[0]?.[0] as any
    expect(opts.auth).toMatchObject({
      mode: 'apiKey',
      apiKey: 'test-rhinestone-key',
    })
    expect(opts.provider?.type).toBe('custom')
    expect(opts).not.toHaveProperty('bundler')
  })

  it('throws when no walletClient is provided', async () => {
    await expect(
      initializeRhinestoneAccount({ publicClient: mockPublicClient }),
    ).rejects.toThrow('A walletClient must be provided')
  })

  it('throws when wallet client has no account address', async () => {
    const walletClientNoAccount = {
      account: null,
    } as unknown as WalletClientParam

    await expect(
      initializeRhinestoneAccount({
        walletClient: walletClientNoAccount,
        publicClient: mockPublicClient,
      }),
    ).rejects.toThrow('A walletClient must be provided')
  })

  it('returns the correct config shape', async () => {
    const result = await initializeRhinestoneAccount({
      walletClient: mockWalletClient,
      publicClient: mockPublicClient,
    })

    const config: RhinestoneConfig = result.config
    expect(config).toEqual({
      chain: expect.objectContaining({ id: 11155111 }),
      rhinestoneApiKey: 'test-rhinestone-key',
    })
  })

  it('uses a credential-free placeholder in development', async () => {
    vi.stubEnv('VITE_RHINESTONE_API_KEY', '')

    const result = await initializeRhinestoneAccount({
      walletClient: mockWalletClient,
      publicClient: mockPublicClient,
    })

    expect(result.config.rhinestoneApiKey).toBe('local-dev')
    expect(vi.mocked(RhinestoneSDK).mock.calls.at(-1)?.[0]).toMatchObject({
      auth: { mode: 'apiKey', apiKey: 'local-dev' },
    })
  })
})
