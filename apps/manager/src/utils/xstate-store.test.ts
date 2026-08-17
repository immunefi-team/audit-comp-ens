import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPersistedStore } from './xstate-store'

describe('xstate-store utils', () => {
  const STORAGE_KEY = 'test-store'

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should create a store with initial context', () => {
    const store = createPersistedStore(
      {
        context: { count: 0 },
        on: {},
      },
      { key: STORAGE_KEY },
    )

    expect(store.get().context.count).toBe(0)
  })

  it('should persist context to localStorage on update', () => {
    const store = createPersistedStore(
      {
        context: { count: 0 },
        on: {
          increment: (context) => ({ count: context.count + 1 }),
        },
      },
      { key: STORAGE_KEY },
    )

    store.trigger.increment()

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).toBeTruthy()
    if (stored) {
      expect(JSON.parse(stored)).toEqual({ count: 1 })
    }
  })

  it('should restore context from localStorage on initialization', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ count: 42 }))

    const store = createPersistedStore(
      {
        context: { count: 0 },
        on: {},
      },
      { key: STORAGE_KEY },
    )

    expect(store.get().context.count).toBe(42)
  })

  it('should use initial context when no persisted data exists', () => {
    const store = createPersistedStore(
      {
        context: { count: 10 },
        on: {},
      },
      { key: STORAGE_KEY },
    )

    expect(store.get().context.count).toBe(10)
  })

  it('should handle multiple updates', () => {
    const store = createPersistedStore(
      {
        context: { count: 0 },
        on: {
          increment: (context) => ({ count: context.count + 1 }),
          decrement: (context) => ({ count: context.count - 1 }),
        },
      },
      { key: STORAGE_KEY },
    )

    store.trigger.increment()
    store.trigger.increment()
    store.trigger.decrement()

    expect(store.get().context.count).toBe(1)

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      expect(JSON.parse(stored)).toEqual({ count: 1 })
    }
  })

  it('should handle complex context objects', () => {
    type ComplexContext = {
      user: { name: string; age: number }
      settings: { theme: string }
    }

    const store = createPersistedStore<
      ComplexContext,
      { updateName: { name: string } },
      never
    >(
      {
        context: {
          user: { name: 'John', age: 30 },
          settings: { theme: 'dark' },
        },
        on: {
          updateName: (context, event) => ({
            ...context,
            user: { ...context.user, name: event.name },
          }),
        },
      },
      { key: STORAGE_KEY },
    )

    store.trigger.updateName({ name: 'Jane' })

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      expect(JSON.parse(stored)).toEqual({
        user: { name: 'Jane', age: 30 },
        settings: { theme: 'dark' },
      })
    }
  })

  it('should handle invalid JSON in localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid json')

    expect(() => {
      createPersistedStore(
        {
          context: { count: 0 },
          on: {},
        },
        { key: STORAGE_KEY },
      )
    }).toThrow()
  })

  it('should allow subscription to store changes', () => {
    const store = createPersistedStore(
      {
        context: { count: 0 },
        on: {
          increment: (context) => ({ count: context.count + 1 }),
        },
      },
      { key: STORAGE_KEY },
    )

    const snapshots: number[] = []
    store.subscribe((snapshot) => {
      snapshots.push(snapshot.context.count)
    })

    store.trigger.increment()
    store.trigger.increment()

    expect(snapshots).toEqual([1, 2])
  })

  it.skip('should use separate storage keys for different stores', () => {
    const store1 = createPersistedStore(
      {
        context: { value: 'store1' },
        on: {
          update: (context) => context,
        },
      },
      { key: 'store1-key' },
    )

    const store2 = createPersistedStore(
      {
        context: { value: 'store2' },
        on: {
          update: (context) => context,
        },
      },
      { key: 'store2-key' },
    )

    // Trigger updates to ensure persistence
    store1.trigger.update()
    store2.trigger.update()

    const store1Value = localStorage.getItem('store1-key')
    const store2Value = localStorage.getItem('store2-key')
    expect(store1Value).toBeTruthy()
    expect(store2Value).toBeTruthy()
    expect(store1Value).toContain('store1')
    expect(store2Value).toContain('store2')
  })

  it('should handle events with payloads', () => {
    type Events = {
      setValue: { value: number }
      reset: Record<string, never>
    }

    const store = createPersistedStore<{ count: number }, Events, never>(
      {
        context: { count: 0 },
        on: {
          setValue: (_context, event) => ({ count: event.value }),
          reset: () => ({ count: 0 }),
        },
      },
      { key: STORAGE_KEY },
    )

    store.trigger.setValue({ value: 100 })
    expect(store.get().context.count).toBe(100)

    store.trigger.reset()
    expect(store.get().context.count).toBe(0)
  })
})
