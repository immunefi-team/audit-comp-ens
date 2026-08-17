/**
 * DEV-only time-travel config. `import.meta.env` is statically inlined per
 * consuming app by Vite, so these resolve to each app's own env at build time.
 */

/** Endpoint the panel uses to reach Anvil — Vite proxies `/rpc` → the fork. */
export const TIME_TRAVEL_RPC: string =
  (import.meta.env.VITE_TIME_TRAVEL_RPC as string | undefined) ?? '/rpc'

/** True only in dev builds with the flag set; statically false in production. */
export function isTimeTravelEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    (import.meta.env.VITE_TIME_TRAVEL === '1' ||
      import.meta.env.VITE_TIME_TRAVEL === 'true')
  )
}
