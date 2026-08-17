import { describe, expect, it, vi } from 'vitest'
import { withTimeout } from './withTimeout'

describe('withTimeout', () => {
  it('resolves with the original value when the promise settles first', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok')
  })

  it('rejects with the original error when the promise rejects first', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('boom')), 50),
    ).rejects.toThrow('boom')
  })

  it('rejects with a PreflightTimeoutError carrying timeoutMs', async () => {
    const err = (await withTimeout(new Promise(() => {}), 5).catch(
      (e) => e,
    )) as Error & { timeoutMs?: number }
    expect(err.message).toMatch(/timed out after 5ms/)
    expect(err.name).toBe('PreflightTimeoutError')
    expect(err.timeoutMs).toBe(5)
  })

  it.each([
    ['resolve', () => withTimeout(Promise.resolve(42), 1000)],
    [
      'reject',
      () => withTimeout(Promise.reject(new Error('x')), 1000).catch(() => {}),
    ],
  ])('clears the timeout timer on %s', async (_, run) => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout')
    await run()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})
