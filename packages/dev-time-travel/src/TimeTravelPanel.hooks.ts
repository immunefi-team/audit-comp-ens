import { getBlockTimestampMs } from '@ens-apps/utils/time-travel/anvilTime'
import { getChainClock } from '@ens-apps/utils/time-travel/installChainClock'
import { useQuery } from '@tanstack/react-query'
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  clampPos,
  POSITION_STORAGE_KEY,
  type Pos,
  readStoredPos,
} from './TimeTravelPanel.helpers'

/** Reactive warped `Date.now()` (what the app sees), updated every second. */
export function useWarpedNow(intervalMs = 1000): number {
  const [nowMs, setNowMs] = useState<number>(() =>
    typeof window === 'undefined' ? 0 : Date.now(),
  )
  useEffect(() => {
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return nowMs
}

/** Poll the Anvil block timestamp (ms) on mount and every 5s. */
export function useAnvilBlockMs(endpoint: string): {
  blockMs: number | null
  error: string | null
} {
  const { data: blockMs = null, error } = useQuery({
    queryKey: ['anvilBlockMs', endpoint],
    queryFn: () => getBlockTimestampMs(endpoint),
    refetchInterval: 5_000,
  })
  let errorMessage: string | null = null
  if (error)
    errorMessage = error instanceof Error ? error.message : String(error)
  return { blockMs, error: errorMessage }
}

/** On first ever run (no stored offset), align the browser clock to chain. */
export function useFirstRunChainSync(endpoint: string): void {
  useEffect(() => {
    const clock = getChainClock()
    if (!clock || clock.hasStoredOffset()) return
    clock.syncFromChain(endpoint).catch(() => {})
  }, [endpoint])
}

/**
 * Make the panel draggable by a handle. Position persists in localStorage so
 * it survives the reload that each time warp triggers. Returns a node-ref
 * setter (for viewport clamping), drag handlers for the handle, and a position
 * style to merge onto the panel (empty → default corner via the base style).
 */
export function useDraggablePanel(): {
  setNodeRef: (el: HTMLElement | null) => void
  dragHandlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
    onPointerUp: () => void
    onPointerCancel: () => void
  }
  positionStyle: CSSProperties
} {
  const nodeRef = useRef<HTMLElement | null>(null)
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null)
  const [pos, setPos] = useState<Pos | null>(null)

  const setNodeRef = useCallback((el: HTMLElement | null) => {
    nodeRef.current = el
  }, [])

  useEffect(() => {
    const stored = readStoredPos()
    if (stored) setPos(clampPos(stored, nodeRef.current))
  }, [])

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const el = nodeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const offset = dragOffset.current
    if (!offset) return
    setPos(
      clampPos(
        { left: e.clientX - offset.dx, top: e.clientY - offset.dy },
        nodeRef.current,
      ),
    )
  }, [])

  const stopDrag = useCallback(() => {
    if (!dragOffset.current) return
    dragOffset.current = null
    setPos((current) => {
      if (current) {
        try {
          localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(current))
        } catch {
          // ignore (storage disabled)
        }
      }
      return current
    })
  }, [])

  const positionStyle: CSSProperties = pos
    ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' }
    : {}

  return {
    setNodeRef,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: stopDrag,
      onPointerCancel: stopDrag,
    },
    positionStyle,
  }
}
