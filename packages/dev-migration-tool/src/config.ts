/**
 * DEV-only migration tool config. `import.meta.env` is statically inlined per
 * consuming app by Vite, so these resolve to each app's own env at build time.
 */

/** Endpoint the panel uses to reach Anvil — Vite proxies `/rpc` → the fork. */
export const MIGRATION_TOOL_RPC: string =
  (import.meta.env.VITE_MIGRATION_TOOL_RPC as string | undefined) ?? '/rpc'

/** True only in dev builds with the flag set; statically false in production. */
export function isMigrationToolEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    (import.meta.env.VITE_MIGRATION_TOOL === '1' ||
      import.meta.env.VITE_MIGRATION_TOOL === 'true')
  )
}
