/// <reference types="vitest" />

import { fileURLToPath } from 'node:url'
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin'
import babel from '@rolldown/plugin-babel'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    viteReact(),
    lingui(),
    babel({
      presets: [linguiTransformerBabelPreset()],
    }),
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['lcovonly', 'text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // Force a single instance of @rhinestone/sdk. pnpm installs two physically
    // distinct copies (one paired with zod@3 via the WalletConnect peer chain in
    // this app, one with zod@4 in @ens-apps/smart-account). Without deduping,
    // `vi.mock('@rhinestone/sdk')` in a test only patches this app's copy, while
    // the inlined @ens-apps/smart-account source imports the other copy and runs
    // the real SDK. Deduping makes both resolve to one mockable module.
    dedupe: ['@rhinestone/sdk'],
  },
  define: {
    global: 'globalThis',
    'process.env': {},
    'import.meta.env': {},
  },
})
