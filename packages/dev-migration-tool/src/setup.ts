/**
 * DEV-only: no-op side-effect import for the migration tool.
 * Import this in the app entry for gating purposes:
 *
 *   import '@ens-apps/dev-migration-tool/setup'
 *
 * No global setup is needed for this tool — it operates entirely through
 * direct JSON-RPC calls made from the panel component.
 */
export {}
