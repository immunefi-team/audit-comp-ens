// Pure helpers for TimeTravelPanel — no React, no side effects, fully testable.

export const HOUR = 3600
export const DAY = 86_400

export type Pos = { left: number; top: number }

export const POSITION_STORAGE_KEY = 'ens:time-travel:pos'

export function formatDateTime(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  // Explicit-arg `new Date(ms)` is NOT shifted by the chain clock, so this
  // shows the true absolute instant for the given epoch ms.
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

export function formatOffset(ms: number): string {
  if (!ms) return 'real time (no offset)'
  const sign = ms > 0 ? '+' : '−'
  let rem = Math.floor(Math.abs(ms) / 1000)
  const days = Math.floor(rem / DAY)
  rem -= days * DAY
  const hours = Math.floor(rem / HOUR)
  rem -= hours * HOUR
  const mins = Math.floor(rem / 60)
  const parts = [
    days ? `${days}d` : '',
    hours ? `${hours}h` : '',
    mins && !days ? `${mins}m` : '',
  ].filter(Boolean)
  return `${sign}${parts.join(' ') || '0m'}`
}

export function readStoredPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Pos>
    if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
      return { left: parsed.left, top: parsed.top }
    }
    return null
  } catch {
    return null
  }
}

/** Keep the panel within the viewport (with a small margin). */
export function clampPos(pos: Pos, el: HTMLElement | null): Pos {
  if (typeof window === 'undefined') return pos
  const width = el?.offsetWidth ?? 248
  const height = el?.offsetHeight ?? 220
  const maxLeft = Math.max(4, window.innerWidth - width - 4)
  const maxTop = Math.max(4, window.innerHeight - height - 4)
  return {
    left: Math.min(Math.max(4, pos.left), maxLeft),
    top: Math.min(Math.max(4, pos.top), maxTop),
  }
}
