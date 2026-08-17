// Load .env (if present) before any other module reads process.env.
// Imported first in index.js. Uses Node's built-in loader — no dependency.
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env')
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath)
  } catch (e) {
    console.warn('[env] could not load .env:', (e as Error).message)
  }
}
