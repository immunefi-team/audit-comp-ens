import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIsMobile } from './use-mobile'

describe('useIsMobile', () => {
  let matchMediaMock: {
    matches: boolean
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // Create a mock matchMedia object
    matchMediaMock = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    // Mock window.matchMedia
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => matchMediaMock),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should return true at exactly 767px (mobile breakpoint - 1)', () => {
    vi.stubGlobal('innerWidth', 767)
    matchMediaMock.matches = true

    const { result } = renderHook(() => useIsMobile())

    waitFor(() => expect(result.current).toBe(true))
  })

  it('should return false at exactly 768px (desktop breakpoint)', () => {
    vi.stubGlobal('innerWidth', 768)
    matchMediaMock.matches = false

    const { result } = renderHook(() => useIsMobile())

    waitFor(() => expect(result.current).toBe(false))
  })

  it('should register and clean up matchMedia event listener', () => {
    vi.stubGlobal('innerWidth', 1024)

    const { unmount } = renderHook(() => useIsMobile())

    expect(matchMediaMock.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )

    unmount()

    expect(matchMediaMock.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
  })

  it('should update when viewport size changes', () => {
    vi.stubGlobal('innerWidth', 1024)
    matchMediaMock.matches = false

    const { result } = renderHook(() => useIsMobile())

    waitFor(() => expect(result.current).toBe(false))

    // Simulate viewport resize to mobile
    vi.stubGlobal('innerWidth', 375)
    matchMediaMock.matches = true

    // Trigger the change event
    const changeHandler = matchMediaMock.addEventListener.mock.calls[0][1]
    changeHandler()

    waitFor(() => expect(result.current).toBe(true))
  })
})
