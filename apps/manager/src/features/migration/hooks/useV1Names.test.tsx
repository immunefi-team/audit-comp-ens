import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { ok } from 'neverthrow'
import type { ReactNode } from 'react'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const smartAccountMock = vi.hoisted(() => ({
  useSmartAccountContext: vi.fn(),
}))

const wagmiMock = vi.hoisted(() => ({
  useConnection: vi.fn(),
}))

const v1SubgraphMock = vi.hoisted(() => ({
  getV1NamesForAddress: vi.fn(),
}))

vi.mock('@/lib/smart-account', () => smartAccountMock)
vi.mock('wagmi', () => wagmiMock)
vi.mock('@/features/migration/service/v1SubgraphClient', () => v1SubgraphMock)

import { useV1Names } from './useV1Names'

const WALLET_ADDRESS = '0xA6362Dcb7Db14C357E788C876eE99e1f982f1115' as Address
const OWNER_ADDRESS = '0x1111111111111111111111111111111111111111'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('useV1Names', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    smartAccountMock.useSmartAccountContext.mockReturnValue({
      ownerAddress: null,
    })
    wagmiMock.useConnection.mockReturnValue({
      address: WALLET_ADDRESS,
    })
    v1SubgraphMock.getV1NamesForAddress.mockReturnValue(ok([]))
  })

  it('uses the wagmi address when the smart-account owner is not available', async () => {
    renderHook(() => useV1Names(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(v1SubgraphMock.getV1NamesForAddress).toHaveBeenCalledWith(
        WALLET_ADDRESS,
      )
    })
  })

  it('prefers the smart-account owner when it is available', async () => {
    smartAccountMock.useSmartAccountContext.mockReturnValue({
      ownerAddress: OWNER_ADDRESS,
    })

    renderHook(() => useV1Names(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(v1SubgraphMock.getV1NamesForAddress).toHaveBeenCalledWith(
        OWNER_ADDRESS,
      )
    })
  })
})
