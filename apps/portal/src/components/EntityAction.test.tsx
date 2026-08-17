import { describe, expect, it } from 'vitest'
import { entityActionVariants } from './EntityAction'

describe('entityActionVariants', () => {
  // Chips sit inside timeline rows (MetaRow, table cells) that hand down mono
  // and letter-spacing — see #1030. Without this reset they inherit both.
  it('resets inherited font and tracking by default', () => {
    const classes = entityActionVariants()

    expect(classes).toContain('font-sans')
    expect(classes).toContain('tracking-normal')
  })

  it('does not carry the sans reset into the mono variant', () => {
    const classes = entityActionVariants({ font: 'mono' })

    expect(classes).toContain('font-mono')
    expect(classes).not.toContain('font-sans')
    expect(classes).not.toContain('tracking-normal')
  })
})
