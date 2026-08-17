import type { QueryClient } from '@tanstack/react-query'
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
  rpcCall,
} from './MigrationTestPanel.helpers'

/** Invalidates all migration-scoped React Query caches on mount. */
export function useInvalidateMigrationQueriesOnMount(
  queryClient: QueryClient,
): void {
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: [{ $scope: 'migration' }] })
  }, [queryClient])
}

/** Poll Anvil connection status every 5s. */
export function useAnvilStatus(endpoint: string): 'ok' | 'error' | 'checking' {
  const [status, setStatus] = useState<'ok' | 'error' | 'checking'>('checking')
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        await rpcCall(endpoint, 'eth_blockNumber', [])
        if (!cancelled) setStatus('ok')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    void check()
    const id = setInterval(() => void check(), 5_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [endpoint])
  return status
}

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
