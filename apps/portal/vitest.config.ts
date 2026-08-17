import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-utils/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'clover', 'json'],
      exclude: [
        'node_modules/',
        'src/test-utils/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.d.ts',
        '**/routeTree.gen.ts',
        'src/vite-env.d.ts',
        'vite.config.ts',
        'vitest.config.ts',
      ],
      // Uncomment to enforce coverage thresholds (will fail tests if not met)
      // thresholds: {
      //   statements: 50,
      //   branches: 50,
      //   functions: 50,
      //   lines: 50,
      // },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ens-apps/utils': fileURLToPath(
        new URL('../../packages/utils/src', import.meta.url),
      ),
      '@ens-apps/l2-primary': fileURLToPath(
        new URL('../../packages/l2-primary/src', import.meta.url),
      ),
      '@ens-apps/transaction-manager': fileURLToPath(
        new URL('../../packages/transaction-manager/src', import.meta.url),
      ),
    },
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
  },
})
