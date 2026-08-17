import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sleep } from './sleep'

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves after the specified duration', async () => {
    const promise = sleep(1000)

    // Should not resolve immediately
    let resolved = false
    promise.then(() => {
      resolved = true
    })

    expect(resolved).toBe(false)

    // Advance timers by 999ms - should still not be resolved
    await vi.advanceTimersByTimeAsync(999)
    expect(resolved).toBe(false)

    // Advance by 1 more ms - should now be resolved
    await vi.advanceTimersByTimeAsync(1)
    expect(resolved).toBe(true)
  })

  it('returns a Promise', () => {
    const result = sleep(100)
    expect(result).toBeInstanceOf(Promise)
  })

  it('resolves to undefined', async () => {
    const promise = sleep(100)
    vi.advanceTimersByTime(100)
    const result = await promise
    expect(result).toBeUndefined()
  })

  it('works with 0ms delay', async () => {
    const promise = sleep(0)
    vi.advanceTimersByTime(0)
    await expect(promise).resolves.toBeUndefined()
  })
})
