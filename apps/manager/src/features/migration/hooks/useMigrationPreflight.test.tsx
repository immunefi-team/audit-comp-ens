import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('wagmi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wagmi')>()
  return {
    ...actual,
    useConfig: vi.fn(() => ({})),
    usePublicClient: vi.fn(),
  }
})

vi.mock('@/features/migration/service/computeMigrationPreflight', () => ({
  computeMigrationPreflight: vi.fn(),
  EMPTY_PREFLIGHT: {
    preExistingOwnedPermRes: null,
    skipApprovalPhase: false,
    skipFetchProfilesPhase: false,
    baseRegistrarApproved: false,
    nameWrapperApproved: false,
  },
}))

import { usePublicClient } from 'wagmi'
import { computeMigrationPreflight } from '@/features/migration/service/computeMigrationPreflight'
import type { V1Domain } from '@/features/migration/service/v1SubgraphClient'
import { useMigrationPreflight } from './useMigrationPreflight'

const usePublicClientMock = vi.mocked(usePublicClient)
const computeMigrationPreflightMock = vi.mocked(computeMigrationPreflight)

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const EOA = '0x0000000000000000000000000000000000000001' as const

const domain = (id: string): V1Domain =>
  ({
    id,
    name: `${id}.eth`,
    labelName: id,
    labelhash: `0x${id}`,
  }) as unknown as V1Domain

beforeEach(() => {
  usePublicClientMock.mockReset()
  computeMigrationPreflightMock.mockReset()
  // biome-ignore lint/suspicious/noExplicitAny: partial PublicClient stub
  usePublicClientMock.mockReturnValue({} as any)
})

describe('useMigrationPreflight', () => {
  it('returns EMPTY_PREFLIGHT without calling computeMigrationPreflight when eoa is undefined', async () => {
    const { result } = renderHook(
      () => useMigrationPreflight({ eoa: undefined }),
      { wrapper },
    )
    const preflight = await result.current.ensure([domain('alice')])
    expect(preflight).toEqual({
      preExistingOwnedPermRes: null,
      skipApprovalPhase: false,
      skipFetchProfilesPhase: false,
      baseRegistrarApproved: false,
      nameWrapperApproved: false,
    })
    expect(computeMigrationPreflightMock).not.toHaveBeenCalled()
  })

  it('returns EMPTY_PREFLIGHT when publicClient is unavailable', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: simulate missing client
    usePublicClientMock.mockReturnValueOnce(undefined as any)
    const { result } = renderHook(() => useMigrationPreflight({ eoa: EOA }), {
      wrapper,
    })
    const preflight = await result.current.ensure([domain('alice')])
    expect(preflight).toEqual({
      preExistingOwnedPermRes: null,
      skipApprovalPhase: false,
      skipFetchProfilesPhase: false,
      baseRegistrarApproved: false,
      nameWrapperApproved: false,
    })
    expect(computeMigrationPreflightMock).not.toHaveBeenCalled()
  })

  it('delegates to computeMigrationPreflight and returns its result', async () => {
    computeMigrationPreflightMock.mockResolvedValueOnce({
      preExistingOwnedPermRes:
        '0x00000000000000000000000000000000000000f0' as const,
      skipApprovalPhase: true,
      skipFetchProfilesPhase: true,
      baseRegistrarApproved: false,
      nameWrapperApproved: false,
    })
    const { result } = renderHook(() => useMigrationPreflight({ eoa: EOA }), {
      wrapper,
    })
    const preflight = await result.current.ensure([domain('alice')])
    expect(preflight.skipApprovalPhase).toBe(true)
    expect(computeMigrationPreflightMock).toHaveBeenCalledTimes(1)
  })

  it('caches across calls with the same inputs (no duplicate compute)', async () => {
    computeMigrationPreflightMock.mockResolvedValue({
      preExistingOwnedPermRes: null,
      skipApprovalPhase: false,
      skipFetchProfilesPhase: false,
      baseRegistrarApproved: false,
      nameWrapperApproved: false,
    })
    const { result } = renderHook(() => useMigrationPreflight({ eoa: EOA }), {
      wrapper,
    })
    const domains = [domain('alice'), domain('bob')]
    await result.current.ensure(domains)
    await result.current.ensure(domains)
    expect(computeMigrationPreflightMock).toHaveBeenCalledTimes(1)
  })

  it('cache key is invariant under domain ordering (sorts ids)', async () => {
    computeMigrationPreflightMock.mockResolvedValue({
      preExistingOwnedPermRes: null,
      skipApprovalPhase: false,
      skipFetchProfilesPhase: false,
      baseRegistrarApproved: false,
      nameWrapperApproved: false,
    })
    const { result } = renderHook(() => useMigrationPreflight({ eoa: EOA }), {
      wrapper,
    })
    await result.current.ensure([domain('alice'), domain('bob')])
    await result.current.ensure([domain('bob'), domain('alice')])
    expect(computeMigrationPreflightMock).toHaveBeenCalledTimes(1)
  })

  it('recomputes cached preflight when requested with staleTime 0', async () => {
    computeMigrationPreflightMock.mockResolvedValue({
      preExistingOwnedPermRes: null,
      skipApprovalPhase: false,
      skipFetchProfilesPhase: false,
      baseRegistrarApproved: false,
      nameWrapperApproved: false,
    })
    const { result } = renderHook(() => useMigrationPreflight({ eoa: EOA }), {
      wrapper,
    })
    const domains = [domain('alice')]
    await result.current.ensure(domains)
    await result.current.ensure(domains, { staleTime: 0 })
    expect(computeMigrationPreflightMock).toHaveBeenCalledTimes(2)
  })
})
