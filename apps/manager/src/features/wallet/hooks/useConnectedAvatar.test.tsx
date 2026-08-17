import { useQuery } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConnectedReverseName } from '@/features/wallet/hooks/useConnectedReverseName'
import { useConnectedAvatar } from './useConnectedAvatar'

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}))

vi.mock('@/features/wallet/hooks/useConnectedReverseName', () => ({
  useConnectedReverseName: vi.fn(),
}))

const mockReverseName = ({
  data,
  isLoading = false,
}: {
  readonly data?: string
  readonly isLoading?: boolean
}) => {
  vi.mocked(useConnectedReverseName).mockReturnValue({
    data,
    error: null,
    isLoading,
  } as unknown as ReturnType<typeof useConnectedReverseName>)
}

const mockProfileRecords = ({
  data,
  isLoading = false,
}: {
  readonly data?: { readonly texts: Array<{ key: string; value: string }> }
  readonly isLoading?: boolean
}) => {
  vi.mocked(useQuery).mockReturnValue({
    data,
    error: null,
    isLoading,
  } as unknown as ReturnType<typeof useQuery>)
}

describe('useConnectedAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the connected profile theme for generated avatars', () => {
    mockReverseName({ data: 'alia.eth' })
    mockProfileRecords({
      data: { texts: [{ key: 'theme', value: '#984D1B' }] },
    })

    const { result } = renderHook(() => useConnectedAvatar())

    expect(result.current.themeColor).toBe('#984D1B')
    expect(result.current.isLoading).toBe(false)
    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    )
  })

  it('does not fetch profile records without a connected reverse name', () => {
    mockReverseName({})
    mockProfileRecords({})

    const { result } = renderHook(() => useConnectedAvatar())

    expect(result.current.themeColor).toBeUndefined()
    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    )
  })

  it('does not override the generated avatar color without a saved theme', () => {
    mockReverseName({ data: 'alia.eth' })
    mockProfileRecords({ data: { texts: [] } })

    const { result } = renderHook(() => useConnectedAvatar())

    expect(result.current.themeColor).toBeUndefined()
  })
})
