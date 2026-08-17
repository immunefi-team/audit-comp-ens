/**
 * `@ens-apps/dev-migration-tool` — DEV-only V1 name creation + migration tooling.
 *
 * Apps:
 *  - `import '@ens-apps/dev-migration-tool/setup'` in their entry (side-effect gating).
 *  - mount `<MigrationTestPanel />` (gated by `isMigrationToolEnabled()`) in the root.
 *  - use `MIGRATION_TOOL_RPC` / `isMigrationToolEnabled` in dev-only feature code.
 */
export { isMigrationToolEnabled, MIGRATION_TOOL_RPC } from './config'
export { MigrationPanelContent, MigrationTestPanel } from './MigrationTestPanel'
