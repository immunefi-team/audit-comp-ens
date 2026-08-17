import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const stylesPath = join(dirname(fileURLToPath(import.meta.url)), 'index.css')
const styles = readFileSync(stylesPath, 'utf8')

describe('global Sonner styles', () => {
  it('defines type-specific palettes for styled toasts', () => {
    for (const type of ['success', 'info', 'loading', 'warning', 'error']) {
      expect(styles).toContain(
        `[data-sonner-toast].ens-sonner-toast[data-styled="true"][data-type="${type}"]`,
      )
    }
  })
})
