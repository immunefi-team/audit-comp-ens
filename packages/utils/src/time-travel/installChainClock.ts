/**
 * Browser-side clock that tracks Anvil's block time for MANUAL testing.
 *
 * Why this exists: the ENS apps compute "now" from the browser's `Date.now()`
 * (e.g. `useGraceStatus`, `premiumDecay`, `useTickingNowMs`), while expiry and
 * premium come from the chain. The Playwright suite keeps the two in sync via
 * `page.clock` (see `e2e/fixtures/time.ts`). A real browser has no `page.clock`,
 * so warping Anvil alone leaves the UI's clock at real wall-clock time and
 * grace / premium / expiry UIs never reflect the warp.
 *
 * `installChainClock` is the manual-browser equivalent: it shifts `Date` by a
 * persisted offset so the app's notion of "now" equals the (warp-able) Anvil
 * block time. Real timers are left intact, so the shifted clock keeps ticking
 * at wall-clock speed and countdowns still run.
 *
 * DEV / manual-testing ONLY — callers must gate installation behind a build
 * flag (e.g. `import.meta.env.DEV && import.meta.env.VITE_TIME_TRAVEL`).
 */
import { getBlockTimestampMs } from './anvilTime.js'

/** localStorage key for the persisted offset (ms). Survives reloads. */
export const OFFSET_STORAGE_KEY = 'ens:time-travel:offsetMs'

const GLOBAL_FLAG = '__ensChainClockInstalled'

export type ChainClock = {
  /** Current offset in ms (chainTime − realTime). */
  getOffsetMs: () => number
  /** Set the offset explicitly (ms) and persist it. */
  setOffsetMs: (offsetMs: number) => void
  /** Re-derive the offset from the live Anvil block (avoids drift). */
  syncFromChain: (endpoint?: string) => Promise<number>
  /** Reset the browser clock back to real wall-clock time. */
  clearOffset: () => void
  /** Whether an offset has ever been persisted (vs. a fresh session). */
  hasStoredOffset: () => boolean
}

function readStoredOffset(): number {
  try {
    const raw = localStorage.getItem(OFFSET_STORAGE_KEY)
    const n = raw == null ? 0 : Number(raw)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeStoredOffset(offsetMs: number): void {
  try {
    localStorage.setItem(OFFSET_STORAGE_KEY, String(offsetMs))
  } catch {
    // ignore (private mode / storage disabled)
  }
}

/**
 * Patch the global `Date` so `Date.now()` and the zero-arg `new Date()` are
 * shifted by the current offset. Explicit `new Date(value)` is left untouched
 * (e.g. `new Date(graceEndSeconds * 1000)` in `useGraceStatus.ts`).
 *
 * Idempotent: repeated calls (HMR / React StrictMode) return the existing
 * control surface without re-patching.
 */
export function installChainClock(): ChainClock {
  const globalRef = globalThis as typeof globalThis & {
    [GLOBAL_FLAG]?: ChainClock
  }
  const existing = globalRef[GLOBAL_FLAG]
  if (existing) return existing

  const RealDate = Date
  const realNow = RealDate.now.bind(RealDate)
  let offsetMs = readStoredOffset()

  const shiftedNow = (): number => realNow() + offsetMs

  class ChainDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(shiftedNow())
        return
      }
      super(...(args as unknown as ConstructorParameters<typeof Date>))
    }

    static now(): number {
      return shiftedNow()
    }
  }

  // Static helpers are inherited via `extends`, but assign explicitly so they
  // survive class-transpilation of built-in subclasses across engines.
  ChainDate.parse = RealDate.parse
  ChainDate.UTC = RealDate.UTC

  globalThis.Date = ChainDate as unknown as DateConstructor

  const control: ChainClock = {
    getOffsetMs: () => offsetMs,
    setOffsetMs: (next) => {
      offsetMs = Number.isFinite(next) ? next : 0
      writeStoredOffset(offsetMs)
    },
    clearOffset: () => {
      offsetMs = 0
      writeStoredOffset(0)
    },
    hasStoredOffset: () => {
      try {
        return localStorage.getItem(OFFSET_STORAGE_KEY) != null
      } catch {
        return false
      }
    },
    syncFromChain: async (endpoint) => {
      const chainMs = await getBlockTimestampMs(endpoint)
      offsetMs = chainMs - realNow()
      writeStoredOffset(offsetMs)
      return offsetMs
    },
  }

  globalRef[GLOBAL_FLAG] = control

  console.info(
    `[time-travel] chain clock installed (offset ${Math.round(
      offsetMs / 1000,
    )}s). Date.now() is now shifted to track Anvil.`,
  )

  return control
}

/** Access the installed clock, if any (after `installChainClock`). */
export function getChainClock(): ChainClock | undefined {
  return (globalThis as typeof globalThis & { [GLOBAL_FLAG]?: ChainClock })[
    GLOBAL_FLAG
  ]
}
