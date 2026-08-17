/// <reference types="vitest" />

import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import i18nextLoader from '@ensdomains/vite-plugin-i18next-loader'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const locales = dirname(
  fileURLToPath(import.meta.resolve('@ensdomains/locales')),
)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 3001,
    proxy: {
      // Local E2E: proxy RPC to Anvil fork
      '/rpc': {
        target: 'http://127.0.0.1:8545',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc/, ''),
      },
      '/bundler': {
        target: 'http://127.0.0.1:4337',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bundler/, ''),
      },
      '/paymaster': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/paymaster/, ''),
      },
      '/indexer': {
        target: 'http://127.0.0.1:5655',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/indexer/, ''),
      },
    },
  },
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      routeFileIgnorePattern: '.((css|const).ts)',
    }),
    viteReact(),
    i18nextLoader({ paths: [locales] }),
    tailwindcss(),
    ...(mode !== 'development' ? [cloudflare()] : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ens-apps/dev-time-travel': fileURLToPath(
        new URL('../../packages/dev-time-travel/src', import.meta.url),
      ),
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
      '@tanstack/react-query',
    ],
  },
  optimizeDeps: {
    exclude: ['@ens-apps/l2-primary', '@ens-apps/transaction-manager'],
  },
  build: {
    rolldownOptions: {
      experimental: {
        lazyBarrel: true, // Reduces compiled modules for barrel exports
      },
    },
  },
}))
