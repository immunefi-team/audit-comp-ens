import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebounce'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 500))
    expect(result.current).toBe('initial')
  })

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      },
    )

    expect(result.current).toBe('initial')

    // Update value
    rerender({ value: 'updated', delay: 500 })

    // Value should not update immediately
    expect(result.current).toBe('initial')

    // Fast-forward time
    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    // Now it should be updated
    expect(result.current).toBe('updated')
  })

  it('should reset timer when value changes before delay completes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      },
    )

    // First update
    rerender({ value: 'first', delay: 500 })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // Second update before first completes
    rerender({ value: 'second', delay: 500 })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // Should still be initial
    expect(result.current).toBe('initial')

    // Complete the second delay
    await act(async () => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current).toBe('second')
  })
})
