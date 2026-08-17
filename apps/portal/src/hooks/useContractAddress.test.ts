import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createTestWrapper, sepoliaWithEns } from '@/test-utils'

// Mock the wagmi lib to avoid pulling the full wallet stack into the test
vi.mock('@/lib/wagmi', () => ({
  sepoliaWithEns,
}))

// Dynamic import after mocking
const { useContractAddress } = await import('./useContractAddress')

describe('useContractAddress', () => {
  it('should return a valid Ethereum address', () => {
    const wrapper = createTestWrapper()

    const { result } = renderHook(
      () =>
        useContractAddress({
          contract: 'ensBaseRegistrarImplementation',
        }),
      { wrapper },
    )

    // Should return a valid Ethereum address format
    expect(result.current).toMatch(/^0x[a-fA-F0-9]{40}$/)
  })
})
