import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setAuthState =
  vi.fn<(state: { authKey: string | null; modalDismissed: boolean }) => void>()
let authState: { authKey: string | null; modalDismissed: boolean } = {
  authKey: null,
  modalDismissed: false,
}

vi.mock('@/utils/backend-client', () => ({
  backendAuthStore: {
    subscribe: vi.fn(),
    getSnapshot: () => ({ context: authState }),
  },
}))

vi.mock('@xstate/store-react', () => ({
  useSelector: <T,>(
    _store: unknown,
    selector: (state: { context: typeof authState }) => T,
  ): T => selector({ context: authState }),
}))

import { useOpenModalOnFirstVisit } from './useOpenModalOnFirstVisit'

const resetAuth = () => {
  authState = { authKey: null, modalDismissed: false }
  setAuthState(authState)
}

beforeEach(() => {
  localStorage.clear()
  resetAuth()
})

afterEach(() => {
  localStorage.clear()
  resetAuth()
})

describe('useOpenModalOnFirstVisit', () => {
  it('stays closed when not connected', () => {
    authState = { authKey: 'x', modalDismissed: false }
    const { result } = renderHook(() => useOpenModalOnFirstVisit(false, true))
    expect(result.current.open).toBe(false)
  })

  it('stays closed when there are no v1 names', () => {
    authState = { authKey: 'x', modalDismissed: false }
    const { result } = renderHook(() => useOpenModalOnFirstVisit(true, false))
    expect(result.current.open).toBe(false)
  })

  it('stays closed when auth is not resolved (no authKey, not dismissed)', () => {
    authState = { authKey: null, modalDismissed: false }
    const { result } = renderHook(() => useOpenModalOnFirstVisit(true, true))
    expect(result.current.open).toBe(false)
  })

  it('opens when connected, has v1 names, and auth is resolved via authKey', () => {
    authState = { authKey: 'jwt', modalDismissed: false }
    const { result } = renderHook(() => useOpenModalOnFirstVisit(true, true))
    expect(result.current.open).toBe(true)
  })

  it('opens when auth is resolved via modalDismissed flag', () => {
    authState = { authKey: null, modalDismissed: true }
    const { result } = renderHook(() => useOpenModalOnFirstVisit(true, true))
    expect(result.current.open).toBe(true)
  })

  it('marks localStorage flag on open so it does not re-open on next mount', () => {
    authState = { authKey: 'jwt', modalDismissed: false }
    const first = renderHook(() => useOpenModalOnFirstVisit(true, true))
    expect(first.result.current.open).toBe(true)
    expect(localStorage.getItem('migration-modal-dismissed')).toBe('true')

    first.unmount()
    const second = renderHook(() => useOpenModalOnFirstVisit(true, true))
    expect(second.result.current.open).toBe(false)
  })

  it('stays closed when localStorage flag is already set', () => {
    authState = { authKey: 'jwt', modalDismissed: false }
    localStorage.setItem('migration-modal-dismissed', 'true')
    const { result } = renderHook(() => useOpenModalOnFirstVisit(true, true))
    expect(result.current.open).toBe(false)
  })

  it('dismiss sets the localStorage flag and closes the modal', () => {
    authState = { authKey: 'jwt', modalDismissed: false }
    const { result } = renderHook(() => useOpenModalOnFirstVisit(true, true))
    expect(result.current.open).toBe(true)

    act(() => result.current.dismiss())

    expect(result.current.open).toBe(false)
    expect(localStorage.getItem('migration-modal-dismissed')).toBe('true')
  })
})
