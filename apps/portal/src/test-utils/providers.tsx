import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { mockWagmiConfig } from './wagmi.mock'

/**
 * Create a fresh QueryClient for each test
 * Prevents test pollution and ensures isolated test state
 */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
        gcTime: Number.POSITIVE_INFINITY, // Prevent garbage collection during tests
        staleTime: 0, // Always refetch in tests
      },
      mutations: {
        retry: false,
      },
    },
  })

/**
 * Wrapper component that provides all necessary providers for testing
 * Includes QueryClient and WagmiProvider
 */
export const createTestWrapper = (queryClient = createTestQueryClient()) => {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <WagmiProvider config={mockWagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    )
  }
}
