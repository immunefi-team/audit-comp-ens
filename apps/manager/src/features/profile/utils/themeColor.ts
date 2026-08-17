import type { CSSProperties } from 'react'
import {
  DEFAULT_THEME_COLOR,
  PROFILE_THEMES,
  type ProfileTheme,
} from '../constants'

const HEX_COLOR_REGEX = /^#[\da-f]{6}$/i
const DEFAULT_BUTTON_TEXT_COLOR = '#191919'

export type ThemeVars = CSSProperties & {
  readonly '--theme-bg': string
  readonly '--theme-button-bg': string
  readonly '--theme-button-hover-bg': string
  readonly '--theme-button-text': string
  readonly '--theme-color': string
  readonly '--theme-hover-bg': string
  readonly '--theme-surface': string
}

const DEFAULT_PROFILE_THEME =
  PROFILE_THEMES.find((theme) => theme.value === DEFAULT_THEME_COLOR) ??
  PROFILE_THEMES[0]
const PROFILE_THEMES_BY_HEX = new Map<string, ProfileTheme>(
  PROFILE_THEMES.map((theme) => [theme.value.toLowerCase(), theme]),
)
const PROFILE_THEME_ALIASES_BY_HEX = new Map<string, ProfileTheme>(
  PROFILE_THEMES.flatMap((theme) =>
    theme.aliases.map((alias) => [alias.toLowerCase(), theme] as const),
  ),
)

const getKnownProfileTheme = (
  normalizedHex: string,
): ProfileTheme | undefined =>
  PROFILE_THEMES_BY_HEX.get(normalizedHex) ??
  PROFILE_THEME_ALIASES_BY_HEX.get(normalizedHex)

const mix = (channel: number, whiteRatio: number): number =>
  Math.round(channel + (255 - channel) * whiteRatio)

const mixFloor = (channel: number, whiteRatio: number): number =>
  Math.floor(channel + (255 - channel) * whiteRatio)

const toHex = (channel: number): string =>
  channel.toString(16).padStart(2, '0').toUpperCase()

export const resolveThemeColor = (hex?: string | null): string => {
  const trimmedHex = hex?.trim()
  if (!trimmedHex || !HEX_COLOR_REGEX.test(trimmedHex)) {
    return DEFAULT_THEME_COLOR
  }

  const normalizedHex = trimmedHex.toLowerCase()
  return getKnownProfileTheme(normalizedHex)?.value ?? trimmedHex
}

export const getProfileTheme = (hex?: string | null): ProfileTheme => {
  const trimmedHex = hex?.trim()
  if (!trimmedHex || !HEX_COLOR_REGEX.test(trimmedHex)) {
    return DEFAULT_PROFILE_THEME
  }

  return getKnownProfileTheme(trimmedHex.toLowerCase()) ?? DEFAULT_PROFILE_THEME
}

export const getThemeVars = (hex?: string | null): ThemeVars => {
  const safeHex = resolveThemeColor(hex)
  const r = parseInt(safeHex.slice(1, 3), 16)
  const g = parseInt(safeHex.slice(3, 5), 16)
  const b = parseInt(safeHex.slice(5, 7), 16)

  const colorHex = (ratio: number) =>
    `#${toHex(mix(r, ratio))}${toHex(mix(g, ratio))}${toHex(mix(b, ratio))}`
  const buttonColorHex = (ratio: number) =>
    `#${toHex(mixFloor(r, ratio))}${toHex(mixFloor(g, ratio))}${toHex(
      mixFloor(b, ratio),
    )}`
  const profileTheme = PROFILE_THEMES_BY_HEX.get(safeHex.toLowerCase())
  const buttonTextColor =
    profileTheme?.buttonTextColor ?? DEFAULT_BUTTON_TEXT_COLOR

  return {
    '--theme-color': safeHex,
    '--theme-surface': colorHex(0.45),
    '--theme-bg': colorHex(0.85),
    '--theme-hover-bg': colorHex(0.75),
    '--theme-button-bg': buttonColorHex(0.88),
    '--theme-button-hover-bg': buttonColorHex(0.82),
    '--theme-button-text': buttonTextColor,
  }
}
