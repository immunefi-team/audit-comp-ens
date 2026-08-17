import { sepolia } from 'viem/chains'
import { describe, expect, it, vi } from 'vitest'

// Mock wagmi config
const mockGetClient = vi.fn()
const mockConfig = {
  getClient: mockGetClient,
}

vi.mock('../wagmi', () => ({
  wagmiConfig: mockConfig,
  sepoliaWithEns: { ...sepolia, id: 11155111 },
}))

// Mock getConnectorClient from @wagmi/core
const mockGetConnectorClient = vi.fn()
vi.mock('@wagmi/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@wagmi/core')>()
  return {
    ...actual,
    getConnectorClient: mockGetConnectorClient,
  }
})

// Dynamic import after mocking
const { safeGetClient, safeGetConnectorClient } = await import('./helpers')

describe('wagmi/helpers', () => {
  describe('safeGetClient', () => {
    it('should return Ok with client on success', () => {
      const mockClient = {
        chain: { id: 11155111, name: 'Sepolia' },
        transport: { type: 'http' },
      }
      mockGetClient.mockReturnValue(mockClient)

      const result = safeGetClient()

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual(mockClient)
      }
    })

    it('should return Err when client retrieval fails', () => {
      mockGetClient.mockImplementation(() => {
        throw new Error('Failed to get client')
      })

      const result = safeGetClient()

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('Wagmi/ClientError')
        expect(result.error.cause).toBeDefined()
      }
    })
  })

  describe('safeGetConnectorClient', () => {
    it('should return Ok with connector client on success', async () => {
      const mockConnectorClient = {
        account: { address: '0x1234' },
        chain: { id: 1 },
      }
      mockGetConnectorClient.mockResolvedValue(mockConnectorClient)

      const result = await safeGetConnectorClient(
        mockConfig as unknown as Parameters<typeof safeGetConnectorClient>[0],
        {
          chainId: 1,
        },
      )

      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value).toEqual(mockConnectorClient)
      }
    })

    it('should return Err when connector client retrieval fails', async () => {
      mockGetConnectorClient.mockRejectedValue(
        new Error('No connector available'),
      )

      const result = await safeGetConnectorClient(
        mockConfig as unknown as Parameters<typeof safeGetConnectorClient>[0],
        {
          chainId: 1,
        },
      )

      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error._tag).toBe('Wagmi/ConnectorClientError')
        expect(result.error.cause).toBeDefined()
      }
    })
  })
})
