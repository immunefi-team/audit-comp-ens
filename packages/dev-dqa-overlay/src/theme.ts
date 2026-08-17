/**
 * Shared dev-tools theme (dark default). Single source of truth for the
 * DevDrawer chrome, the DQA panel, and the overlay (pins/popovers) — persisted
 * in localStorage under `dqa_theme` (same key overlay.js reads on boot).
 */

export type DqaTheme = 'dark' | 'light'

const STORAGE_KEY = 'dqa_theme'
const EVENT = 'dqa:theme'

export function getDqaTheme(): DqaTheme {
  if (typeof window === 'undefined') return 'dark'
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light'
      ? 'light'
      : 'dark'
  } catch {
    return 'dark'
  }
}

export function setDqaTheme(theme: DqaTheme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {}
  // Keep the overlay chrome (pins, popovers) in sync when it's loaded.
  window.__DQA__?.setTheme?.(theme)
  window.dispatchEvent(new CustomEvent(EVENT, { detail: theme }))
}

export function toggleDqaTheme(): DqaTheme {
  const next: DqaTheme = getDqaTheme() === 'dark' ? 'light' : 'dark'
  setDqaTheme(next)
  return next
}

/** Notifies on theme changes from this tab (custom event) or others (storage). */
export function subscribeDqaTheme(cb: (theme: DqaTheme) => void): () => void {
  const onChange = () => cb(getDqaTheme())
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
