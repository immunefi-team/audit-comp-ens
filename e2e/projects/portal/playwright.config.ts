import { defineConfig } from '@playwright/test'
import { baseConfig } from '../../playwright.config.base.js'

export default defineConfig({
  ...baseConfig,
  testDir: './tests',
  use: {
    ...baseConfig.use,
    baseURL: process.env.PORTAL_APP_URL ?? 'http://localhost:3001',
  },
  projects: [
    {
      name: 'portal-e2e',
      testMatch: /.*\.spec\.ts$/, // all tests in the tests directory
    },
  ],
})
