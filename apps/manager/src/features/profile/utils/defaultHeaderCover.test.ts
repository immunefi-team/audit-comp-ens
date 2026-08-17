import { describe, expect, it } from 'vitest'
import {
  getDefaultHeaderCover,
  getLoadingHeaderCover,
} from './defaultHeaderCover'

const decodeSvg = (cover: string): string => {
  const [, encodedSvg] = cover.split(',')
  return decodeURIComponent(encodedSvg ?? '')
}

describe('getDefaultHeaderCover', () => {
  it.each([
    ['#02293B', '#02293B'],
    ['#E72A96', '#E72A96'],
    ['#0082BB', '#0082BB'],
    ['#007C20', '#007C20'],
    ['#984D1B', '#984D1B'],
  ])('generates the matching SVG cover for the %s profile theme', (themeColor, blendColor) => {
    const cover = getDefaultHeaderCover({ themeColor })
    const svg = decodeSvg(cover)

    expect(cover).toMatch(/^data:image\/svg\+xml,/)
    expect(svg).toContain(`fill="${blendColor}" style="mix-blend-mode:color"`)
    expect(svg).toContain('<use href="#')
    expect(svg).not.toContain('<image')
    expect(svg).not.toContain('data:image/png')
  })

  it('uses Lapis when the profile has no saved theme', () => {
    expect(decodeSvg(getDefaultHeaderCover({}))).toContain(
      'fill="#0082BB" style="mix-blend-mode:color"',
    )
  })

  it('resolves legacy theme aliases to the same cached SVG', () => {
    expect(getDefaultHeaderCover({ themeColor: '#ED2496' })).toBe(
      getDefaultHeaderCover({ themeColor: '#E72A96' }),
    )
  })

  it('uses the grace-period cover color', () => {
    const svg = decodeSvg(
      getDefaultHeaderCover({ isInGrace: true, themeColor: '#007C20' }),
    )

    expect(svg).toContain('fill="#87514C" style="mix-blend-mode:color"')
  })

  it('uses the neutral Quartz color for the loading cover', () => {
    expect(decodeSvg(getLoadingHeaderCover())).toContain(
      'fill="#C7C6C4" style="mix-blend-mode:color"',
    )
  })
})
