// Vite injects `import.meta.env` at build time. This declaration
// keeps TypeScript happy when the indexer package is type-checked
// outside a Vite context (e.g. `pnpm typecheck` in CI).
interface ImportMetaEnv {
  readonly VITE_INDEXER_GRAPHQL_URL?: string
  readonly VITE_SEPOLIA_RPC_URL?: string
  readonly VITE_SEPOLIA_RPC_URL_SERVER?: string
}

interface ImportMeta {
  readonly env?: ImportMetaEnv
}
