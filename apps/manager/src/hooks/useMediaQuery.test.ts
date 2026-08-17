import { useMediaQuery } from '@ens-apps/utils/useMediaQuery'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useMediaQuery', () => {
  let mockMatchMedia: ReturnType<typeof vi.fn>
  let listeners: Map<string, (e: MediaQueryListEvent) => void>

  beforeEach(() => {
    listeners = new Map()

    mockMatchMedia = vi.fn((query: string) => {
      const mediaQueryList = {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(
          (event: string, listener: (e: MediaQueryListEvent) => void) => {
            if (event === 'change') {
              listeners.set(query, listener)
            }
          },
        ),
        removeEventListener: vi.fn(
          (event: string, listener: (e: MediaQueryListEvent) => void) => {
            if (event === 'change' && listeners.get(query) === listener) {
              listeners.delete(query)
            }
          },
        ),
        dispatchEvent: vi.fn(),
      }
      return mediaQueryList
    })

    vi.stubGlobal('matchMedia', mockMatchMedia)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    listeners.clear()
  })

  describe('initial state', () => {
    it('should return false when media query does not match', () => {
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

      expect(result.current).toBe(false)
    })

    it('should return true when media query matches', () => {
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn((event: string, listener: () => void) => {
          if (event === 'change') listeners.set(query, listener)
        }),
        removeEventListener: vi.fn(),
      }))

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

      expect(result.current).toBe(true)
    })
  })

  describe('media query changes', () => {
    it('should update when media query match changes', () => {
      let currentMatches = false

      mockMatchMedia.mockImplementation((query: string) => ({
        get matches() {
          return currentMatches
        },
        media: query,
        addEventListener: vi.fn(
          (event: string, listener: (e: MediaQueryListEvent) => void) => {
            if (event === 'change') listeners.set(query, listener)
          },
        ),
        removeEventListener: vi.fn(),
      }))

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

      expect(result.current).toBe(false)

      act(() => {
        currentMatches = true
        const listener = listeners.get('(min-width: 768px)')
        if (listener) {
          listener({ matches: true } as MediaQueryListEvent)
        }
      })

      expect(result.current).toBe(true)
    })

    it('should update from matching to not matching', () => {
      let currentMatches = true

      mockMatchMedia.mockImplementation((query: string) => ({
        get matches() {
          return currentMatches
        },
        media: query,
        addEventListener: vi.fn(
          (event: string, listener: (e: MediaQueryListEvent) => void) => {
            if (event === 'change') listeners.set(query, listener)
          },
        ),
        removeEventListener: vi.fn(),
      }))

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))

      expect(result.current).toBe(true)

      act(() => {
        currentMatches = false
        const listener = listeners.get('(min-width: 768px)')
        if (listener) {
          listener({ matches: false } as MediaQueryListEvent)
        }
      })

      expect(result.current).toBe(false)
    })
  })

  describe('query changes', () => {
    it('should re-evaluate when query changes', () => {
      const queryMatches: Record<string, boolean> = {
        '(min-width: 768px)': false,
        '(min-width: 1024px)': true,
      }

      mockMatchMedia.mockImplementation((query: string) => ({
        matches: queryMatches[query] ?? false,
        media: query,
        addEventListener: vi.fn(
          (event: string, listener: (e: MediaQueryListEvent) => void) => {
            if (event === 'change') listeners.set(query, listener)
          },
        ),
        removeEventListener: vi.fn(),
      }))

      const { result, rerender } = renderHook(
        ({ query }) => useMediaQuery(query),
        { initialProps: { query: '(min-width: 768px)' } },
      )

      expect(result.current).toBe(false)

      rerender({ query: '(min-width: 1024px)' })

      expect(result.current).toBe(true)
    })
  })

  describe('cleanup', () => {
    it('should remove event listener on unmount', () => {
      const removeEventListenerMock = vi.fn()

      mockMatchMedia.mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(
          (event: string, listener: (e: MediaQueryListEvent) => void) => {
            if (event === 'change') listeners.set(query, listener)
          },
        ),
        removeEventListener: removeEventListenerMock,
      }))

      const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'))

      unmount()

      expect(removeEventListenerMock).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      )
    })

    it('should remove old listener and add new one when query changes', () => {
      const addEventListenerMock = vi.fn(
        (event: string, listener: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') listeners.set('current', listener)
        },
      )
      const removeEventListenerMock = vi.fn()

      mockMatchMedia.mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      }))

      const { rerender } = renderHook(({ query }) => useMediaQuery(query), {
        initialProps: { query: '(min-width: 768px)' },
      })

      expect(addEventListenerMock).toHaveBeenCalledTimes(1)

      rerender({ query: '(min-width: 1024px)' })

      expect(removeEventListenerMock).toHaveBeenCalled()
      expect(addEventListenerMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('common media queries', () => {
    it('should work with prefers-color-scheme query', () => {
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))

      const { result } = renderHook(() =>
        useMediaQuery('(prefers-color-scheme: dark)'),
      )

      expect(result.current).toBe(true)
    })

    it('should work with prefers-reduced-motion query', () => {
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))

      const { result } = renderHook(() =>
        useMediaQuery('(prefers-reduced-motion: reduce)'),
      )

      expect(result.current).toBe(true)
    })

    it('should work with max-width query', () => {
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: query === '(max-width: 640px)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))

      const { result } = renderHook(() => useMediaQuery('(max-width: 640px)'))

      expect(result.current).toBe(true)
    })
  })
})
