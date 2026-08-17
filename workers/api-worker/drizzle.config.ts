import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// Load `.env` into process.env if present (replaces `dotenv/config`).
// `process.loadEnvFile` is native to Node (>=20.12); guard on existence so
// the config still works when the env is provided another way (CI, exports).
if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

export default defineConfig({
  out: './drizzle',
  schema: './src/core/database/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})
