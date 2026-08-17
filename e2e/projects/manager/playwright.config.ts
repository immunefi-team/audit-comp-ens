import { defineConfig } from '@playwright/test'
import { baseConfig } from '../../playwright.config.base.js'

export default defineConfig({
  ...baseConfig,
  timeout: 300_000,
  testDir: './tests',
  use: {
    ...baseConfig.use,
    baseURL: process.env.MANAGER_APP_URL ?? 'http://localhost:3000',
  },
  projects: [
    {
      name: 'manager-e2e',
      testMatch: /\.spec\.ts$/,
      // TODO: restore notification coverage once the notification mock is wired into snapshot env
      testIgnore: /temporaryPremium|migration|notification/,
    },
  ],
})
