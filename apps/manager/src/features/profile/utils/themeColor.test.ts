import { describe, expect, it } from 'vitest'
import {
  PROFILE_THEMES,
  THEME_COLOR_ALIASES,
  THEME_COLORS,
} from '@/features/profile/constants'
import { getProfileTheme, getThemeVars, resolveThemeColor } from './themeColor'

const hexToRgb = (hex: string): readonly [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

const getRelativeLuminance = (hex: string): number => {
  const channels = hexToRgb(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  return (
    (channels[0] ?? 0) * 0.2126 +
    (channels[1] ?? 0) * 0.7152 +
    (channels[2] ?? 0) * 0.0722
  )
}

const getContrastRatio = (foreground: string, background: string): number => {
  const foregroundLuminance = getRelativeLuminance(foreground)
  const backgroundLuminance = getRelativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

const expectedButtonThemes = {
  '#02293B': {
    '--theme-button-bg': '#E0E5E7',
    '--theme-button-text': '#02293B',
  },
  '#E72A96': {
    '--theme-button-bg': '#FCE5F2',
    '--theme-button-text': '#5A0024',
  },
  '#0082BB': {
    '--theme-button-bg': '#E0F0F6',
    '--theme-button-text': '#02293B',
  },
  '#007C20': {
    '--theme-button-bg': '#E0EFE4',
    '--theme-button-text': '#033010',
  },
  '#984D1B': {
    '--theme-button-bg': '#F2E9E3',
    '--theme-button-text': '#441B03',
  },
} as const

describe('getThemeVars', () => {
  it('derives exported theme colors from the profile theme registry', () => {
    expect(THEME_COLORS).toEqual(
      PROFILE_THEMES.map(({ label, value }) => ({ label, value })),
    )
  })

  it('resolves profile themes from canonical values and aliases', () => {
    for (const theme of PROFILE_THEMES) {
      expect(getProfileTheme(theme.value)).toBe(theme)
      for (const alias of theme.aliases) {
        expect(getProfileTheme(alias)).toBe(theme)
      }
    }
  })

  it('keeps the legacy alias export in sync with the registry', () => {
    expect(THEME_COLOR_ALIASES).toEqual({
      '#000000': '#02293B',
      '#191919': '#02293B',
      '#ED2496': '#E72A96',
      '#0080BC': '#0082BB',
      '#007C23': '#007C20',
    })
  })

  it('resolves legacy saved theme aliases to canonical values', () => {
    expect(resolveThemeColor('#000000')).toBe('#02293B')
    expect(resolveThemeColor('#191919')).toBe('#02293B')
    expect(resolveThemeColor('#ED2496')).toBe('#E72A96')
    expect(resolveThemeColor('#0080BC')).toBe('#0082BB')
    expect(resolveThemeColor('#007C23')).toBe('#007C20')
  })

  it('returns accessible profile action button colors for every theme', () => {
    for (const theme of THEME_COLORS) {
      const vars = getThemeVars(theme.value)
      const expected = expectedButtonThemes[theme.value]

      expect(vars).toMatchObject(expected)
      expect(
        getContrastRatio(
          vars['--theme-button-text'] ?? '',
          vars['--theme-button-bg'] ?? '',
        ),
      ).toBeGreaterThanOrEqual(4.5)
      expect(
        getContrastRatio(
          vars['--theme-button-text'] ?? '',
          vars['--theme-button-hover-bg'] ?? '',
        ),
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('uses the updated accessible button colors for legacy saved themes', () => {
    expect(getThemeVars('#ED2496')).toMatchObject(
      expectedButtonThemes['#E72A96'],
    )
    expect(getThemeVars('#0080BC')).toMatchObject(
      expectedButtonThemes['#0082BB'],
    )
    expect(getThemeVars('#007C23')).toMatchObject(
      expectedButtonThemes['#007C20'],
    )
    expect(getThemeVars('#000000')).toMatchObject(
      expectedButtonThemes['#02293B'],
    )
  })
})
