import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePreventUnload } from './usePreventUnload'

describe('usePreventUnload', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds beforeunload listener when enabled', () => {
    renderHook(() => usePreventUnload(true))

    expect(addEventListenerSpy).toHaveBeenCalledTimes(1)
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    )
  })

  it('does not add or remove listener when disabled', () => {
    renderHook(() => usePreventUnload(false))

    expect(addEventListenerSpy).not.toHaveBeenCalled()
    expect(removeEventListenerSpy).not.toHaveBeenCalled()
  })

  it('removes listener on unmount when enabled', () => {
    const { unmount } = renderHook(() => usePreventUnload(true))
    const handler = addEventListenerSpy.mock.calls[0][1]

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledTimes(1)
    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', handler)
  })

  it('removes listener when enabled switches to false', () => {
    const { rerender } = renderHook(
      ({ enabled }) => usePreventUnload(enabled),
      { initialProps: { enabled: true } },
    )
    const handler = addEventListenerSpy.mock.calls[0][1]

    rerender({ enabled: false })

    expect(removeEventListenerSpy).toHaveBeenCalledTimes(1)
    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', handler)
  })

  it('calls preventDefault on beforeunload event', () => {
    renderHook(() => usePreventUnload(true))
    const handler = addEventListenerSpy.mock.calls[0][1] as (
      e: BeforeUnloadEvent,
    ) => void

    const e = { preventDefault: vi.fn() }
    handler(e as unknown as BeforeUnloadEvent)

    expect(e.preventDefault).toHaveBeenCalled()
  })
})
