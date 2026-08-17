import { useRef, useSyncExternalStore } from 'react'
import {
  createRafProgressStore,
  type RafProgressAdvance,
  type RafProgressStore,
} from '../lib/rafProgressStore'

export interface UseRafProgressOptions<TContext> {
  advance: RafProgressAdvance<TContext>
  context: TContext
  resetGeneration?: number
  initial?: number
  snap?: (value: number) => number
}

/**
 * Subscribe to a monotonic rAF-driven scalar (e.g. 0–100 fill progress).
 * Uses `useSyncExternalStore` — no useEffect.
 */
export function useRafProgress<TContext>({
  advance,
  context,
  resetGeneration = 0,
  initial = 0,
  snap,
}: UseRafProgressOptions<TContext>): number {
  const advanceRef = useRef(advance)
  advanceRef.current = advance

  const snapRef = useRef(snap)
  snapRef.current = snap

  const storeRef = useRef<RafProgressStore<TContext> | null>(null)
  if (!storeRef.current) {
    storeRef.current = createRafProgressStore({
      initial,
      advance: (ctx, current, dt) => advanceRef.current(ctx, current, dt),
      snap: (value) => snapRef.current?.(value) ?? value,
    })
  }

  const store = storeRef.current
  store.setContext(context, resetGeneration)

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  )
}
