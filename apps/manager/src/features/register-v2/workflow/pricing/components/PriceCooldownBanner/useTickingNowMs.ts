import { useEffect, useState } from 'react'

/**
 * Reactive `Date.now()` that re-renders the subscriber every `intervalMs`.
 *
 * Drives the chart's `now` dot crawl and the banner pill's per-second
 * premium recomputation between on-chain rentPrice refetches.
 */
export function useTickingNowMs(intervalMs = 1000, enabled = true): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now())

  useEffect(() => {
    if (!enabled) return
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])

  return nowMs
}
