export type RafProgressAdvance<TContext> = (
  context: TContext,
  current: number,
  dtSeconds: number,
) => number

export interface RafProgressStore<TContext> {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => number
  getServerSnapshot: () => number
  setContext: (context: TContext, resetGeneration?: number) => void
}

export interface CreateRafProgressStoreOptions<TContext> {
  advance: RafProgressAdvance<TContext>
  initial?: number
  snap?: (value: number) => number
}

const DEFAULT_SNAP = (value: number) => value

/** rAF-driven scalar progress — starts on subscribe, stops when idle. */
export function createRafProgressStore<TContext>({
  advance,
  initial = 0,
  snap = DEFAULT_SNAP,
}: CreateRafProgressStoreOptions<TContext>): RafProgressStore<TContext> {
  let progress = initial
  let trackedGeneration = -1
  let context: TContext | undefined
  const listeners = new Set<() => void>()
  let rafId = 0
  let lastTime = 0

  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  const tick = (now: number) => {
    if (listeners.size === 0 || context === undefined) return

    const dt = lastTime > 0 ? Math.min((now - lastTime) / 1000, 0.1) : 0
    lastTime = now

    const next = snap(advance(context, progress, dt))

    if (next !== progress) {
      progress = next
      notify()
    }

    rafId = requestAnimationFrame(tick)
  }

  const startLoop = () => {
    if (rafId !== 0) return
    lastTime = 0
    rafId = requestAnimationFrame(tick)
  }

  const stopLoop = () => {
    if (rafId === 0) return
    cancelAnimationFrame(rafId)
    rafId = 0
    lastTime = 0
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) startLoop()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stopLoop()
      }
    },
    getSnapshot() {
      return progress
    },
    getServerSnapshot() {
      return initial
    },
    setContext(next, resetGeneration = 0) {
      if (resetGeneration !== trackedGeneration) {
        trackedGeneration = resetGeneration
        progress = initial
        notify()
      }
      context = next
    },
  }
}
