import { createIsomorphicFn } from '@tanstack/react-start'
import {
  createStore,
  type EventObject,
  type EventPayloadMap,
  type StoreConfig,
  type StoreContext,
  type StoreExtension,
  type StoreSnapshot,
} from '@xstate/store-react'

export type PersistedStoreOptions = {
  key: string
}

export const createPersistedStore = <
  // biome-ignore lint/suspicious/noExplicitAny: Yes
  TContext extends Record<string, any>,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventPayloadMap,
>(
  { context, ...rest }: StoreConfig<TContext, TEventPayloadMap, TEmitted>,
  { key }: PersistedStoreOptions,
) => {
  const persistedContext =
    typeof window === 'undefined' ? undefined : localStorage.getItem(key)
  const initialContext = persistedContext
    ? (JSON.parse(persistedContext) as TContext)
    : context

  const store = createStore({
    context: initialContext,
    ...rest,
  })

  store.subscribe((snapshot) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(snapshot.context))
    }
  })

  return store
}

type PersistOptions = {
  /** The local storage key to use for persisting the store. */
  name: string
  /** Custom serializer for storing/retrieving data from localStorage */
  serde?: {
    serialize: (value: unknown) => string
    deserialize: (value: string) => unknown
  }
  /** Custom storage */
  storage?: Storage
}

const getDefaultStorage = createIsomorphicFn()
  .client(() => localStorage)
  .server(() => undefined)

// Default serializer using JSON
const DEFAULT_SERDE = {
  serialize: JSON.stringify,
  deserialize: JSON.parse,
}

// Load persisted state from localStorage
function loadPersistedState<TContext extends StoreContext>(
  key: string,
  storage: Storage,
  serde: PersistOptions['serde'],
  fallbackContext: TContext,
): TContext {
  try {
    const serialized = storage.getItem(key)
    if (!serialized) {
      return fallbackContext
    }

    const { deserialize } = serde || DEFAULT_SERDE
    const persisted = deserialize(serialized)

    // Validate that the persisted data has the expected structure
    if (persisted && typeof persisted === 'object' && 'context' in persisted) {
      return (persisted as { context: TContext }).context
    }

    return fallbackContext
  } catch (error) {
    console.warn(`Failed to load persisted state for key "${key}":`, error)
    return fallbackContext
  }
}

// Save state to localStorage
function savePersistedState<TContext extends StoreContext>(
  key: string,
  snapshot: StoreSnapshot<TContext>,
  serde: PersistOptions['serde'],
  storage: Storage,
): void {
  try {
    const { serialize } = serde || DEFAULT_SERDE
    const serialized = serialize(snapshot)
    storage.setItem(key, serialized)
  } catch (error) {
    console.warn(`Failed to save persisted state for key "${key}":`, error)
  }
}

/**
 * Adds persistence functionality to xstate store logic.
 *
 * @example
 * // Using with .with() (recommended)
 * ```ts
 * const store = createStore({
 *   context: { count: 0 },
 *   on: {
 *     inc: (ctx) => ({ count: ctx.count + 1 })
 *   }
 * }).with(persist({ name: 'my-store-key' }));
 * ```
 *
 * @example
 * // Using sessionStorage instead of localStorage
 * ```ts
 * const store = createStore({
 *   context: { foo: 'bar' },
 *   on: { update: (ctx, e) => ({ foo: e.value }) }
 * }).with(persist({ name: 'example-session', storage: window.sessionStorage }));
 * ```
 *
 * @example
 * // Using custom serde (serialization/deserialization)
 * ```ts
 * const customSerde = {
 *   serialize: (snapshot) => btoa(JSON.stringify(snapshot)),
 *   deserialize: (str) => JSON.parse(atob(str)),
 * };
 *
 * const store = createStore({
 *   context: { foo: 'bar' },
 *   on: { update: (ctx, e) => ({ foo: e.value }) }
 * }).with(persist({ name: 'encoded-store', serde: customSerde }));
 * ```
 *
 * @param options PersistOptions for customizing storage, serialization, and key.
 * @returns Store extension providing state persistence.
 */
export const persist = <
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject,
>(
  options: PersistOptions,
): StoreExtension<
  TContext,
  TEventPayloadMap,
  Record<string, never>,
  TEmitted
> => {
  const storage = options.storage ?? getDefaultStorage()

  return (logic) => {
    if (!storage) return logic

    return {
      getInitialSnapshot() {
        const initialSnapshot = logic.getInitialSnapshot()

        return {
          ...initialSnapshot,
          context: loadPersistedState(
            options.name,
            storage,
            options.serde,
            initialSnapshot.context,
          ),
        }
      },
      transition(snapshot, event) {
        const [nextState, effects] = logic.transition(snapshot, event)
        savePersistedState(options.name, nextState, options.serde, storage)
        return [nextState, effects]
      },
    }
  }
}
