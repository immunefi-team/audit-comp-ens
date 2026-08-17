import { defineConfig } from '@playwright/test'
import { baseConfig } from '../../playwright.config.base.js'

export default defineConfig({
  ...baseConfig,
  testDir: './tests',
  use: {
    ...baseConfig.use,
    baseURL: process.env.MANAGER_APP_URL ?? 'http://localhost:3000',
  },
  projects: [
    {
      name: 'manager-premium-e2e',
      testMatch: /temporaryPremium\.spec\.ts$/,
    },
  ],
})
