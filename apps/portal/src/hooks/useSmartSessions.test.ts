import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useSmartSessions } from './useSmartSessions'

const STORAGE_KEY = 'smart-sessions'
const ADDRESS_A = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as const
const ADDRESS_B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as const

describe('useSmartSessions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should default to enabled (true) for a new address', () => {
    const { result } = renderHook(() => useSmartSessions(ADDRESS_A))

    expect(result.current[0]).toBe(true)
  })

  it('should persist preference to localStorage when toggled', () => {
    const { result } = renderHook(() => useSmartSessions(ADDRESS_A))

    act(() => {
      result.current[1](false)
    })

    expect(result.current[0]).toBe(false)

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).toBeDefined()
    expect(JSON.parse(stored ?? '{}')).toEqual({ [ADDRESS_A]: false })
  })

  it('should load existing preference from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [ADDRESS_A]: false }))

    const { result } = renderHook(() => useSmartSessions(ADDRESS_A))

    expect(result.current[0]).toBe(false)
  })

  it('should store preferences per address', () => {
    const { result: hookA } = renderHook(() => useSmartSessions(ADDRESS_A))
    const { result: hookB } = renderHook(() => useSmartSessions(ADDRESS_B))

    act(() => {
      hookA.current[1](false)
    })

    expect(hookA.current[0]).toBe(false)
    expect(hookB.current[0]).toBe(true)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored[ADDRESS_A]).toBe(false)
    expect(stored[ADDRESS_B]).toBeUndefined()
  })

  it('should default to true when address is undefined', () => {
    const { result } = renderHook(() => useSmartSessions(undefined))

    expect(result.current[0]).toBe(true)
  })

  it('should not update localStorage when address is undefined', () => {
    const { result } = renderHook(() => useSmartSessions(undefined))

    act(() => {
      result.current[1](false)
    })

    expect(result.current[0]).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({})
  })
})
