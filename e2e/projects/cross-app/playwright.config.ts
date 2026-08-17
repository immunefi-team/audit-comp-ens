import { defineConfig } from '@playwright/test'
import { baseConfig } from '../../playwright.config.base.js'

export default defineConfig({
  ...baseConfig,
  testDir: './tests',
  projects: [
    {
      name: 'cross-app-e2e',
      testMatch: /\.spec\.ts$/,
    },
  ],
})
