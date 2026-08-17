import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const smartAccountMock = vi.hoisted(() => ({
  useSmartAccountContext: vi.fn(),
}))

const wagmiMock = vi.hoisted(() => ({
  useConnection: vi.fn(),
}))

const reverseNameMock = vi.hoisted(() => ({
  profileReverseNameQuery: vi.fn((address: Address | undefined) => ({
    queryFn: () => Promise.resolve(null),
    queryKey: ['profile', 'reverse_name', address],
  })),
}))

vi.mock('@/lib/smart-account', () => smartAccountMock)
vi.mock('wagmi', () => wagmiMock)
vi.mock('@/features/profile/service/profileReverseName', () => reverseNameMock)

import { useConnectedReverseName } from './useConnectedReverseName'

const WALLET_ADDRESS = '0xA6362Dcb7Db14C357E788C876eE99e1f982f1115' as Address
const OWNER_ADDRESS = '0x1111111111111111111111111111111111111111' as Address

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

describe('useConnectedReverseName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    smartAccountMock.useSmartAccountContext.mockReturnValue({
      ownerAddress: null,
    })
    wagmiMock.useConnection.mockReturnValue({
      address: WALLET_ADDRESS,
    })
  })

  it('uses the wagmi address when the smart-account owner is not available', () => {
    renderHook(() => useConnectedReverseName(), { wrapper: createWrapper() })

    expect(reverseNameMock.profileReverseNameQuery).toHaveBeenCalledWith(
      WALLET_ADDRESS,
    )
  })

  it('prefers the smart-account owner when it is available', () => {
    smartAccountMock.useSmartAccountContext.mockReturnValue({
      ownerAddress: OWNER_ADDRESS,
    })

    renderHook(() => useConnectedReverseName(), { wrapper: createWrapper() })

    expect(reverseNameMock.profileReverseNameQuery).toHaveBeenCalledWith(
      OWNER_ADDRESS,
    )
  })
})
