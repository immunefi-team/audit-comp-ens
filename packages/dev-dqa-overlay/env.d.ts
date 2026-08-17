// Vite inlines `import.meta.env` per consuming app at build time. This ambient
// declaration keeps the package typechecking standalone (`tsc --noEmit`)
// outside a Vite context. Mirrors packages/dev-time-travel/env.d.ts.
interface ImportMetaEnv {
  readonly DEV: boolean
  readonly VITE_DQA?: string
  readonly VITE_DQA_URL?: string
  readonly VITE_DQA_LINEAR_ISSUE?: string
  readonly VITE_DQA_MOCK_UI?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
