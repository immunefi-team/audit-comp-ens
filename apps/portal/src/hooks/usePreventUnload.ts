import { useEffect } from 'react'

/**
 * Prevents accidental tab/window close when work is in progress.
 * When `enabled` is true, shows the browser's native "Leave site?" dialog on close/refresh.
 */
export const usePreventUnload = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [enabled])
}
