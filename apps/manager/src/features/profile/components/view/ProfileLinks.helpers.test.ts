import { describe, expect, it } from 'vitest'
import { PROFILE_THEMES } from '@/features/profile/constants'
import { getGeneratedLinkPattern } from './ProfileLinks.helpers'

const expectedProfileThemePaletteIds = PROFILE_THEMES.map((theme) =>
  theme.label.toLowerCase(),
)

describe('getGeneratedLinkPattern', () => {
  it('uses every profile theme color as a possible link pattern palette', () => {
    const generatedPaletteIds = new Set(
      Array.from(
        { length: 200 },
        (_, i) => getGeneratedLinkPattern(`https://example-${i}.eth`).paletteId,
      ),
    )

    expect([...generatedPaletteIds].sort()).toEqual(
      [...expectedProfileThemePaletteIds].sort(),
    )
  })

  it('spreads common link hosts across profile theme palettes', () => {
    expect(
      ['https://github.com', 'https://hey.com', 'https://are.na'].map(
        (href) => getGeneratedLinkPattern(href).paletteId,
      ),
    ).toEqual(['lapis', 'peridot', 'citrine'])
  })
})
