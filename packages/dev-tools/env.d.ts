// Vite inlines `import.meta.env` per consuming app at build time. This ambient
// declaration keeps the package typechecking standalone (`tsc --noEmit`)
// outside a Vite context. Includes all VITE_ vars from transitive dev packages.
interface ImportMetaEnv {
  readonly DEV: boolean
  readonly VITE_TIME_TRAVEL?: string
  readonly VITE_TIME_TRAVEL_RPC?: string
  readonly VITE_MIGRATION_TOOL?: string
  readonly VITE_MIGRATION_TOOL_RPC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
