import { vi } from 'vitest'

vi.stubEnv('VITE_RHINESTONE_API_KEY', 'test-rhinestone-key')
// Tests target the smart-account flow; pin the EOA-only flag to false so it
// doesn't bypass the Rhinestone path under test.
vi.stubEnv('VITE_FF_USE_EOA', 'false')

// Mock transaction-manager to avoid import issues
vi.mock('@ens-apps/transaction-manager', () => ({
  Signer: {},
}))

// Mock all external dependencies
vi.mock('wagmi', () => ({
  useWalletClient: vi.fn().mockReturnValue({ data: null }),
  usePublicClient: vi.fn().mockReturnValue({ chain: { id: 11155111 } }),
  useConnection: vi.fn().mockReturnValue({
    address: undefined,
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    status: 'disconnected',
  }),
}))

vi.mock('viem/actions', () => ({
  getBalance: vi.fn().mockResolvedValue(0n),
  readContract: vi.fn().mockResolvedValue(0n),
}))

vi.mock('@/lib/wagmi', () => ({
  customSepolia: { id: 11155111, name: 'Sepolia' },
  publicClient: { chain: { id: 11155111 } },
  SEPOLIA_RPC_URL: 'https://sepolia.example.com',
}))

vi.mock('@/features/shared/service/nameChainContractService', () => ({
  SUPPORTED_TOKENS: {},
}))

vi.mock('@/utils/backend-client', () => ({
  backendClient: {
    wallet: {
      fund: {
        $post: vi.fn().mockResolvedValue({ ok: true, json: () => ({}) }),
      },
      tokens: {
        $get: vi.fn().mockResolvedValue({
          ok: true,
          json: () => ({ chainId: 11155111, tokens: {} }),
        }),
      },
    },
  },
}))

vi.mock('./rhinestone', () => ({
  initializeRhinestoneAccount: vi.fn().mockResolvedValue({
    client: {
      getAddress: vi
        .fn()
        .mockReturnValue('0xSmartAccount123456789012345678901234567890'),
      sendTransaction: vi.fn(),
      waitForExecution: vi.fn(),
    },
    address: '0xSmartAccount123456789012345678901234567890',
    ownerAddress: '0xOwner12345678901234567890123456789012345678',
    config: {
      chain: { id: 11155111 },
      rhinestoneApiKey: 'test-rhinestone-key',
    },
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}))
