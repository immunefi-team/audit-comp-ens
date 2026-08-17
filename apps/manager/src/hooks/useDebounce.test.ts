import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebounce } from './useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic debouncing', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('initial'))

      expect(result.current.debouncedValue).toBe('initial')
    })

    it('should debounce value changes with default delay', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value),
        { initialProps: { value: 'initial' } },
      )

      rerender({ value: 'updated' })
      expect(result.current.debouncedValue).toBe('initial')

      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(result.current.debouncedValue).toBe('initial')

      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(result.current.debouncedValue).toBe('updated')
    })

    it('should use custom delay', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, { delay: 500 }),
        { initialProps: { value: 'initial' } },
      )

      rerender({ value: 'updated' })
      expect(result.current.debouncedValue).toBe('initial')

      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(result.current.debouncedValue).toBe('updated')
    })

    it('should reset timer on rapid changes', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, { delay: 500 }),
        { initialProps: { value: 'a' } },
      )

      rerender({ value: 'b' })
      act(() => {
        vi.advanceTimersByTime(300)
      })

      rerender({ value: 'c' })
      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(result.current.debouncedValue).toBe('a')

      act(() => {
        vi.advanceTimersByTime(200)
      })

      expect(result.current.debouncedValue).toBe('c')
    })
  })

  describe('callback behavior', () => {
    it('should call callback when debounced value changes', () => {
      const callback = vi.fn()
      const { rerender } = renderHook(
        ({ value }) => useDebounce(value, { delay: 500, callback }),
        { initialProps: { value: 'initial' } },
      )

      rerender({ value: 'updated' })
      expect(callback).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith('updated')
    })

    it('should call callback with latest value after rapid changes', () => {
      const callback = vi.fn()
      const { rerender } = renderHook(
        ({ value }) => useDebounce(value, { delay: 500, callback }),
        { initialProps: { value: 'a' } },
      )

      rerender({ value: 'b' })
      rerender({ value: 'c' })
      rerender({ value: 'd' })

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith('d')
    })
  })

  describe('immediateCallback behavior', () => {
    it('should call immediateCallback for empty string', () => {
      const callback = vi.fn()
      const immediateCallback = vi.fn()
      const { rerender } = renderHook(
        ({ value }) =>
          useDebounce(value, { delay: 500, callback, immediateCallback }),
        { initialProps: { value: 'test' } },
      )

      rerender({ value: '' })

      expect(immediateCallback).toHaveBeenCalledTimes(1)
      expect(callback).not.toHaveBeenCalled()
    })

    it('should call immediateCallback for null', () => {
      const callback = vi.fn()
      const immediateCallback = vi.fn()
      const { result, rerender } = renderHook(
        ({ value }) =>
          useDebounce(value, { delay: 500, callback, immediateCallback }),
        { initialProps: { value: 'test' as string | null } },
      )

      rerender({ value: null })

      expect(immediateCallback).toHaveBeenCalledTimes(1)
      expect(result.current.debouncedValue).toBeNull()
    })

    it('should call immediateCallback for undefined', () => {
      const callback = vi.fn()
      const immediateCallback = vi.fn()
      const { result, rerender } = renderHook(
        ({ value }) =>
          useDebounce(value, { delay: 500, callback, immediateCallback }),
        { initialProps: { value: 'test' as string | undefined } },
      )

      rerender({ value: undefined })

      expect(immediateCallback).toHaveBeenCalledTimes(1)
      expect(result.current.debouncedValue).toBeUndefined()
    })

    it('should set debounced value immediately for empty values', () => {
      const { result, rerender } = renderHook(
        ({ value }) =>
          useDebounce(value, { delay: 500, immediateCallback: vi.fn() }),
        { initialProps: { value: 'test' } },
      )

      rerender({ value: '' })

      expect(result.current.debouncedValue).toBe('')
    })

    it('should not call immediateCallback if not provided', () => {
      const callback = vi.fn()
      const { rerender } = renderHook(
        ({ value }) => useDebounce(value, { delay: 500, callback }),
        { initialProps: { value: 'test' } },
      )

      rerender({ value: '' })

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(callback).toHaveBeenCalledWith('')
    })
  })

  describe('cancel function', () => {
    it('should cancel pending debounce', () => {
      const callback = vi.fn()
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, { delay: 500, callback }),
        { initialProps: { value: 'initial' } },
      )

      rerender({ value: 'updated' })

      act(() => {
        vi.advanceTimersByTime(300)
      })

      act(() => {
        result.current.cancel()
      })

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(callback).not.toHaveBeenCalled()
      expect(result.current.debouncedValue).toBe('initial')
    })

    it('should be idempotent', () => {
      const { result } = renderHook(() => useDebounce('test', { delay: 500 }))

      act(() => {
        result.current.cancel()
        result.current.cancel()
        result.current.cancel()
      })
    })
  })

  describe('cleanup', () => {
    it('should cleanup timer on unmount', () => {
      const callback = vi.fn()
      const { rerender, unmount } = renderHook(
        ({ value }) => useDebounce(value, { delay: 500, callback }),
        { initialProps: { value: 'initial' } },
      )

      rerender({ value: 'updated' })

      unmount()

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('type support', () => {
    it('should work with numbers', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, { delay: 500 }),
        { initialProps: { value: 0 } },
      )

      rerender({ value: 42 })

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(result.current.debouncedValue).toBe(42)
    })

    it('should work with objects', () => {
      const obj1 = { name: 'test' }
      const obj2 = { name: 'updated' }

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, { delay: 500 }),
        { initialProps: { value: obj1 } },
      )

      rerender({ value: obj2 })

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(result.current.debouncedValue).toBe(obj2)
    })

    it('should work with arrays', () => {
      const arr1 = [1, 2, 3]
      const arr2 = [4, 5, 6]

      const { result, rerender } = renderHook(
        ({ value }) => useDebounce(value, { delay: 500 }),
        { initialProps: { value: arr1 } },
      )

      rerender({ value: arr2 })

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(result.current.debouncedValue).toBe(arr2)
    })
  })

  describe('default delay', () => {
    it('should use 1000ms as default delay', () => {
      const callback = vi.fn()
      const { rerender } = renderHook(
        ({ value }) => useDebounce(value, { callback }),
        { initialProps: { value: 'initial' } },
      )

      rerender({ value: 'updated' })

      act(() => {
        vi.advanceTimersByTime(999)
      })
      expect(callback).not.toHaveBeenCalled()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })
})
