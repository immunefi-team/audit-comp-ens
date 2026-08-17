// Vite inlines `import.meta.env` per consuming app at build time. This ambient
// declaration keeps the package typechecking standalone (`tsc --noEmit`)
// outside a Vite context. Mirrors packages/dev-time-travel/env.d.ts.
interface ImportMetaEnv {
  readonly DEV: boolean
  readonly VITE_MIGRATION_TOOL?: string
  readonly VITE_MIGRATION_TOOL_RPC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
