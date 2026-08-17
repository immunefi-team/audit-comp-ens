import { describe, expect, it } from 'vitest'
import { MIGRATION_VALUE_PROP_SLIDES } from './migrationValueProps'

describe('MIGRATION_VALUE_PROP_SLIDES', () => {
  it('omits the NFT slide while the commemorative copy is off', () => {
    expect(MIGRATION_VALUE_PROP_SLIDES.map((slide) => slide.id)).toEqual([
      'profiles',
      'favorites',
      'notifications',
      'experience',
    ])
  })

  it('keeps every slide it does show', () => {
    for (const slide of MIGRATION_VALUE_PROP_SLIDES) {
      expect(slide.label).toBeDefined()
      expect(slide.media.src).toBeTruthy()
    }
  })
})
