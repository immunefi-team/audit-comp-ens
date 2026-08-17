/**
 * DevDrawer dock layout preference — bottom sheet (default) or right sidebar.
 * Persisted in localStorage as `ens-devtools:layout`.
 */

export type DevToolsLayout = 'bottom' | 'sidebar'

const STORAGE_KEY = 'ens-devtools:layout'
const EVENT = 'ens-devtools:layout'

export function getDevToolsLayout(): DevToolsLayout {
  if (typeof window === 'undefined') return 'bottom'
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'sidebar'
      ? 'sidebar'
      : 'bottom'
  } catch {
    return 'bottom'
  }
}

export function setDevToolsLayout(layout: DevToolsLayout): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, layout)
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: layout }))
}

/** Notifies on layout changes from this tab (custom event) or others (storage). */
export function subscribeDevToolsLayout(
  cb: (layout: DevToolsLayout) => void,
): () => void {
  const onChange = () => cb(getDevToolsLayout())
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
