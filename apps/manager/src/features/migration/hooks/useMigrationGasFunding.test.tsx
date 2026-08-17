import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fundPostMock = vi.fn()

vi.mock('@/utils/backend-client', () => ({
  backendClient: {
    wallet: {
      fund: {
        $post: (...args: unknown[]) => fundPostMock(...args),
      },
    },
  },
}))

import { useMigrationGasFunding } from './useMigrationGasFunding'

const OWNER = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'

const makeWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  fundPostMock.mockReset()
  fundPostMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })
})

describe('useMigrationGasFunding', () => {
  it('requests funding once and reports funding then settled', async () => {
    const { result } = renderHook(() => useMigrationGasFunding(OWNER), {
      wrapper: makeWrapper(),
    })

    expect(result.current).toBe('funding')
    await waitFor(() => expect(result.current).toBe('settled'))
    expect(fundPostMock).toHaveBeenCalledTimes(1)
    expect(fundPostMock).toHaveBeenCalledWith({ json: { address: OWNER } })
  })

  it('is idle and does not request when there is no owner address', () => {
    const { result } = renderHook(() => useMigrationGasFunding(null), {
      wrapper: makeWrapper(),
    })
    expect(result.current).toBe('idle')
    expect(fundPostMock).not.toHaveBeenCalled()
  })

  it('does not re-fire on re-renders with the same address', async () => {
    const { result, rerender } = renderHook(
      ({ address }: { address: string }) => useMigrationGasFunding(address),
      { initialProps: { address: OWNER }, wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current).toBe('settled'))
    rerender({ address: OWNER })
    rerender({ address: OWNER.toLowerCase() }) // case change is the same owner
    expect(fundPostMock).toHaveBeenCalledTimes(1)
  })

  it('fires again when the owner address changes', async () => {
    const other = '0x1111111111111111111111111111111111111111'
    const { rerender } = renderHook(
      ({ address }: { address: string }) => useMigrationGasFunding(address),
      { initialProps: { address: OWNER }, wrapper: makeWrapper() },
    )

    await waitFor(() => expect(fundPostMock).toHaveBeenCalledTimes(1))
    rerender({ address: other })
    await waitFor(() => expect(fundPostMock).toHaveBeenCalledTimes(2))
    expect(fundPostMock).toHaveBeenLastCalledWith({
      json: { address: other },
    })
  })

  it('settles (does not block) when the request fails (best-effort)', async () => {
    fundPostMock.mockRejectedValueOnce(new Error('network down'))
    const { result } = renderHook(() => useMigrationGasFunding(OWNER), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current).toBe('settled'))
    expect(fundPostMock).toHaveBeenCalledTimes(1)
  })
})
