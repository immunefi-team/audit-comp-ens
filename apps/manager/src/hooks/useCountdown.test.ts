import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdown } from './useCountdown'

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should return null values when targetTimestamp is null', () => {
      const { result } = renderHook(() => useCountdown(null))

      expect(result.current.remainingSeconds).toBeNull()
      expect(result.current.isComplete).toBe(false)
      expect(result.current.isActive).toBe(false)
      expect(result.current.formatted.display).toBe('--:--')
    })

    it('should calculate remaining seconds correctly', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const targetTimestamp = now + 65000

      const { result } = renderHook(() => useCountdown(targetTimestamp))

      expect(result.current.remainingSeconds).toBe(65)
      expect(result.current.isComplete).toBe(false)
      expect(result.current.isActive).toBe(true)
    })

    it('should return 0 for past timestamps', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const targetTimestamp = now - 1000

      const { result } = renderHook(() => useCountdown(targetTimestamp))

      expect(result.current.remainingSeconds).toBe(0)
      expect(result.current.isComplete).toBe(true)
      expect(result.current.isActive).toBe(false)
    })
  })

  describe('formatted output', () => {
    it('should format minutes correctly', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const targetTimestamp = now + 125000

      const { result } = renderHook(() => useCountdown(targetTimestamp))

      expect(result.current.formatted.minutes).toBe('02')
      expect(result.current.formatted.seconds).toBe('05')
      expect(result.current.formatted.display).toBe('02:05')
    })

    it('should pad single digit values', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const targetTimestamp = now + 5000

      const { result } = renderHook(() => useCountdown(targetTimestamp))

      expect(result.current.formatted.minutes).toBe('00')
      expect(result.current.formatted.seconds).toBe('05')
      expect(result.current.formatted.display).toBe('00:05')
    })

    it('should handle zero remaining time', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const { result } = renderHook(() => useCountdown(now))

      expect(result.current.formatted.minutes).toBe('00')
      expect(result.current.formatted.seconds).toBe('00')
      expect(result.current.formatted.display).toBe('00:00')
    })

    it('should handle large values', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const targetTimestamp = now + 3661000

      const { result } = renderHook(() => useCountdown(targetTimestamp))

      expect(result.current.formatted.minutes).toBe('61')
      expect(result.current.formatted.seconds).toBe('01')
      expect(result.current.formatted.display).toBe('61:01')
    })
  })

  describe('countdown behavior', () => {
    it('should decrement remaining seconds over time', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const targetTimestamp = now + 5000

      const { result } = renderHook(() => useCountdown(targetTimestamp))

      expect(result.current.remainingSeconds).toBe(5)

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.remainingSeconds).toBe(4)

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.remainingSeconds).toBe(3)
    })

    it('should use custom interval', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const targetTimestamp = now + 5000

      const { result } = renderHook(() =>
        useCountdown(targetTimestamp, { interval: 500 }),
      )

      expect(result.current.remainingSeconds).toBe(5)

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(result.current.remainingSeconds).toBe(5)

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(result.current.remainingSeconds).toBe(4)
    })

    it('should call onComplete when countdown reaches zero', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const onComplete = vi.fn()
      const targetTimestamp = now + 2000

      renderHook(() => useCountdown(targetTimestamp, { onComplete }))

      expect(onComplete).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('should stop timer after completion', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const onComplete = vi.fn()
      const targetTimestamp = now + 1000

      const { result } = renderHook(() =>
        useCountdown(targetTimestamp, { onComplete }),
      )

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(result.current.isComplete).toBe(true)
      expect(onComplete).toHaveBeenCalledTimes(1)

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(onComplete).toHaveBeenCalledTimes(1)
    })
  })

  describe('target timestamp changes', () => {
    it('should update when targetTimestamp changes', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const { result, rerender } = renderHook(
        ({ target }) => useCountdown(target),
        { initialProps: { target: now + 5000 } },
      )

      expect(result.current.remainingSeconds).toBe(5)

      rerender({ target: now + 10000 })

      expect(result.current.remainingSeconds).toBe(10)
    })

    it('should handle change from null to timestamp', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const { result, rerender } = renderHook(
        ({ target }) => useCountdown(target),
        { initialProps: { target: null as number | null } },
      )

      expect(result.current.remainingSeconds).toBeNull()

      rerender({ target: now + 5000 })

      expect(result.current.remainingSeconds).toBe(5)
    })

    it('should handle change from timestamp to null', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const { result, rerender } = renderHook(
        ({ target }) => useCountdown(target),
        { initialProps: { target: (now + 5000) as number | null } },
      )

      expect(result.current.remainingSeconds).toBe(5)

      rerender({ target: null })

      expect(result.current.remainingSeconds).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should ceil partial seconds', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const targetTimestamp = now + 2500

      const { result } = renderHook(() => useCountdown(targetTimestamp))

      expect(result.current.remainingSeconds).toBe(3)
    })

    it('should not go below zero', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const targetTimestamp = now + 1000

      const { result } = renderHook(() => useCountdown(targetTimestamp))

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(result.current.remainingSeconds).toBe(0)
    })

    it('should cleanup timer on unmount', () => {
      const now = Date.now()
      vi.setSystemTime(now)

      const onComplete = vi.fn()
      const targetTimestamp = now + 5000

      const { unmount } = renderHook(() =>
        useCountdown(targetTimestamp, { onComplete }),
      )

      unmount()

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      expect(onComplete).not.toHaveBeenCalled()
    })
  })
})
