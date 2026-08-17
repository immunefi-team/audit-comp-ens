/** biome-ignore-all lint/suspicious/noExplicitAny: Need to mock the transaction manager */
import { publicResolverSetTextSnippet } from '@ensdomains/ensjs/contracts'
import { encodeFunctionData, namehash } from 'viem'
import { describe, expect, it, vi } from 'vitest'

// Mock the transaction manager
vi.mock('@ens-apps/transaction-manager', () => ({
  transactionManager: {
    startTransaction: vi.fn().mockReturnValue('mock-tx-id'),
  },
  waitForTransaction: vi.fn().mockResolvedValue({
    hash: '0xmockhash',
    receipt: {},
  }),
}))

// Helper to encode setText for test expectations
const encodeSetText = (name: string, key: string, value: string) =>
  encodeFunctionData({
    abi: publicResolverSetTextSnippet,
    functionName: 'setText',
    args: [namehash(name), key, value],
  })

// Mock setRecordsWriteParameters to return realistic data
vi.mock('@ensdomains/ensjs/wallet', () => ({
  setRecordsWriteParameters: vi
    .fn()
    .mockImplementation(async (_client, params) => {
      // Build mock calls based on the input params
      const calls: string[] = []

      if (params.texts) {
        for (const { key, value } of params.texts) {
          calls.push(encodeSetText(params.name, key, value))
        }
      }

      const node = namehash(params.name)

      // Return mock write parameters for multicallWithNodeCheck
      return {
        abi: [
          {
            inputs: [
              { name: '', type: 'bytes32' },
              { name: 'calls', type: 'bytes[]' },
            ],
            name: 'multicallWithNodeCheck',
            outputs: [{ name: '', type: 'bytes[]' }],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        functionName: 'multicallWithNodeCheck',
        args: [node, calls],
      }
    }),
}))

// Import after mocking
import { type SaveRecordsParameters, saveRecords } from './saveRecords'

describe('saveRecords', () => {
  const mockAccountAddress = '0x0987654321098765432109876543210987654321'
  const mockWalletClient = {
    account: { address: mockAccountAddress },
    chain: { id: 11155111 },
  } as any

  const mockParams: SaveRecordsParameters = {
    id: 'mock-tx-id',
    name: 'test.eth',
    resolverAddress: '0x1234567890123456789012345678901234567890',
    originalRecords: [
      { type: 'text', key: 'name', value: 'John' },
      { type: 'text', key: 'email', value: 'john@example.com' },
      { type: 'address', id: 60, key: 'ETH', value: '0xabc123' },
    ],
    pendingChanges: {
      newRecords: [],
      editedValues: new Map([['text-name', 'Jane']]),
      deletedIds: new Set(),
    },
    walletClient: mockWalletClient,
    publicClient: {} as any,
    signer: { type: 'eoa', walletClient: {} as any },
    chainId: 11155111,
  }

  it('throws error when no changes to save', async () => {
    const paramsWithNoChanges = {
      ...mockParams,
      pendingChanges: {
        newRecords: [],
        editedValues: new Map(),
        deletedIds: new Set<string>(),
      },
    }

    await expect(saveRecords(paramsWithNoChanges)).rejects.toThrow(
      'No record changes to save',
    )
  })

  it('returns txId and hash on success', async () => {
    const result = await saveRecords(mockParams)

    expect(result).toEqual({
      txId: 'mock-tx-id',
      hash: '0xmockhash',
    })
  })

  it('calls transactionManager.startTransaction with correct params', async () => {
    const { transactionManager } = await import('@ens-apps/transaction-manager')

    await saveRecords(mockParams)

    expect(transactionManager.startTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'custom',
        request: expect.objectContaining({
          type: 'eoa',
          from: mockAccountAddress,
          to: mockParams.resolverAddress,
          value: 0n,
          chainId: mockParams.chainId,
        }),
      }),
      mockParams.signer,
      expect.objectContaining({
        description: `Update records for ${mockParams.name}`,
        chainId: mockParams.chainId,
      }),
    )
  })

  it('calls setRecordsWriteParameters with correct params', async () => {
    const { setRecordsWriteParameters } = await import(
      '@ensdomains/ensjs/wallet'
    )

    await saveRecords(mockParams)

    expect(setRecordsWriteParameters).toHaveBeenCalledWith(
      mockWalletClient,
      expect.objectContaining({
        name: mockParams.name,
        resolverAddress: mockParams.resolverAddress,
      }),
    )
  })

  it('throws error when wallet client has no account', async () => {
    const paramsWithNoAccount = {
      ...mockParams,
      walletClient: { chain: { id: 11155111 } } as any,
    }

    await expect(saveRecords(paramsWithNoAccount)).rejects.toThrow(
      'Wallet client must have account and chain configured',
    )
  })

  it('throws error when wallet client has no chain', async () => {
    const paramsWithNoChain = {
      ...mockParams,
      walletClient: { account: { address: mockAccountAddress } } as any,
    }

    await expect(saveRecords(paramsWithNoChain)).rejects.toThrow(
      'Wallet client must have account and chain configured',
    )
  })
})

describe('saveRecords encoding (integration)', () => {
  const mockWalletClient = {
    account: { address: '0x0987654321098765432109876543210987654321' },
    chain: { id: 11155111 },
  } as any

  it('generates setText call for edited text records', async () => {
    const { transactionManager } = await import('@ens-apps/transaction-manager')
    vi.mocked(transactionManager.startTransaction).mockClear()

    const params: SaveRecordsParameters = {
      id: 'mock-tx-id',
      name: 'test.eth',
      resolverAddress: '0x1234567890123456789012345678901234567890',
      originalRecords: [{ type: 'text', key: 'description', value: 'old' }],
      pendingChanges: {
        newRecords: [],
        editedValues: new Map([['text-description', 'new description']]),
        deletedIds: new Set(),
      },
      walletClient: mockWalletClient,
      publicClient: {} as any,
      signer: { type: 'eoa', walletClient: {} as any },
      chainId: 11155111,
    }

    await saveRecords(params)

    // Verify the multicall data contains the expected setText call
    const call = vi.mocked(transactionManager.startTransaction).mock.calls[0]
    const requestData = (call[0] as any).request.data as string

    // The data should contain the encoded setText for 'description' -> 'new description'
    const expectedSetTextCall = encodeSetText(
      'test.eth',
      'description',
      'new description',
    )
    expect(requestData).toContain(expectedSetTextCall.slice(2)) // slice to remove 0x prefix
  })

  it('generates setText call with empty string for deleted text records', async () => {
    const { transactionManager } = await import('@ens-apps/transaction-manager')
    vi.mocked(transactionManager.startTransaction).mockClear()

    const params: SaveRecordsParameters = {
      id: 'mock-tx-id',
      name: 'test.eth',
      resolverAddress: '0x1234567890123456789012345678901234567890',
      originalRecords: [{ type: 'text', key: 'twitter', value: '@john' }],
      pendingChanges: {
        newRecords: [],
        editedValues: new Map(),
        deletedIds: new Set(['text-twitter']),
      },
      walletClient: mockWalletClient,
      publicClient: {} as any,
      signer: { type: 'eoa', walletClient: {} as any },
      chainId: 11155111,
    }

    await saveRecords(params)

    const call = vi.mocked(transactionManager.startTransaction).mock.calls[0]
    const requestData = (call[0] as any).request.data as string

    // The data should contain setText('twitter', '') for deletion
    const expectedSetTextCall = encodeSetText('test.eth', 'twitter', '')
    expect(requestData).toContain(expectedSetTextCall.slice(2))
  })

  it('generates setText call for new text records', async () => {
    const { transactionManager } = await import('@ens-apps/transaction-manager')
    vi.mocked(transactionManager.startTransaction).mockClear()

    const params: SaveRecordsParameters = {
      id: 'mock-tx-id',
      name: 'test.eth',
      resolverAddress: '0x1234567890123456789012345678901234567890',
      originalRecords: [],
      pendingChanges: {
        newRecords: [{ type: 'text', key: 'github', value: 'johndoe' }],
        editedValues: new Map(),
        deletedIds: new Set(),
      },
      walletClient: mockWalletClient,
      publicClient: {} as any,
      signer: { type: 'eoa', walletClient: {} as any },
      chainId: 11155111,
    }

    await saveRecords(params)

    const call = vi.mocked(transactionManager.startTransaction).mock.calls[0]
    const requestData = (call[0] as any).request.data as string

    const expectedSetTextCall = encodeSetText('test.eth', 'github', 'johndoe')
    expect(requestData).toContain(expectedSetTextCall.slice(2))
  })

  it('uses correct namehash for multicallWithNodeCheck', async () => {
    const { transactionManager } = await import('@ens-apps/transaction-manager')
    vi.mocked(transactionManager.startTransaction).mockClear()

    const params: SaveRecordsParameters = {
      id: 'mock-tx-id',
      name: 'myname.eth',
      resolverAddress: '0x1234567890123456789012345678901234567890',
      originalRecords: [{ type: 'text', key: 'name', value: 'old' }],
      pendingChanges: {
        newRecords: [],
        editedValues: new Map([['text-name', 'new']]),
        deletedIds: new Set(),
      },
      walletClient: mockWalletClient,
      publicClient: {} as any,
      signer: { type: 'eoa', walletClient: {} as any },
      chainId: 11155111,
    }

    await saveRecords(params)

    const call = vi.mocked(transactionManager.startTransaction).mock.calls[0]
    const requestData = (call[0] as any).request.data as string

    // The namehash of 'myname.eth' should be in the data
    const expectedNode = namehash('myname.eth').slice(2) // remove 0x
    expect(requestData.toLowerCase()).toContain(expectedNode.toLowerCase())
  })
})
