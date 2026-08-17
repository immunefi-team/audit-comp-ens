import { PROFILE_THEMES, type ProfileTheme } from '@/features/profile/constants'
import { getThemeVars } from '@/features/profile/utils/themeColor'

const LINK_PATTERN_SIZE = 320
const LINK_PATTERN_CELL_SIZE = 40
const LINK_PATTERN_COLUMNS = LINK_PATTERN_SIZE / LINK_PATTERN_CELL_SIZE
const LINK_PATTERN_RECT_RADIUS = 6
const LINK_PATTERN_RECT_INSET = 2

type LinkPatternPalette = {
  readonly id: string
  readonly surface: string
  readonly primary: string
  readonly secondary: string
}

type LinkPatternFamily =
  | 'matt-rib-irregular'
  | 'ens-vertical-pairs'
  | 'basket-weave'
  | 'satin-weave'
  | 'sateen-weave'
  | 'royal-oxford'
  | 'curtain'
  | 'two-two-twill'
  | 'three-three-twill'
  | 'herringbone'

type LinkPatternRect = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly fill: string
}

type LinkPatternDirection = 'horizontal' | 'vertical'
type LinkPatternDirectionResolver = (
  column: number,
  row: number,
  variant: number,
) => LinkPatternDirection
type LinkPatternPrimaryResolver = (
  direction: LinkPatternDirection,
  column: number,
  row: number,
  variant: number,
) => boolean

export type GeneratedLinkPattern = {
  readonly backgroundImage: string
  readonly paletteId: string
  readonly patternId: LinkPatternFamily
  readonly variant: number
}

const getLinkPatternPalette = (theme: ProfileTheme): LinkPatternPalette => {
  const themeVars = getThemeVars(theme.value)

  return {
    id: theme.label.toLowerCase(),
    surface: themeVars['--theme-bg'],
    primary: themeVars['--theme-color'],
    secondary: themeVars['--theme-surface'],
  }
}

const linkPatternPalettes = PROFILE_THEMES.map(getLinkPatternPalette)
const fallbackLinkPatternPalette = getLinkPatternPalette(PROFILE_THEMES[0])

const linkPatternFamilies = [
  'matt-rib-irregular',
  'ens-vertical-pairs',
  'basket-weave',
  'satin-weave',
  'sateen-weave',
  'royal-oxford',
  'curtain',
  'two-two-twill',
  'three-three-twill',
  'herringbone',
] satisfies readonly [LinkPatternFamily, ...LinkPatternFamily[]]

const hashString = (value: string): number => {
  let hash = 2166136261

  for (const character of value.toLowerCase()) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

const positiveModulo = (value: number, divisor: number): number =>
  ((value % divisor) + divisor) % divisor

const linkPatternDirectionResolvers = {
  'matt-rib-irregular': (column, row, variant) =>
    positiveModulo(Math.floor((column + variant) / 2) + row + (row % 3), 2) ===
    0
      ? 'horizontal'
      : 'vertical',
  'ens-vertical-pairs': (column, _row, variant) =>
    positiveModulo(Math.floor((column + variant) / 2), 2) === 0
      ? 'vertical'
      : 'horizontal',
  'basket-weave': (column, row, variant) =>
    positiveModulo(
      Math.floor((column + variant) / 2) + Math.floor(row / 2),
      2,
    ) === 0
      ? 'horizontal'
      : 'vertical',
  'satin-weave': (column, row, variant) =>
    positiveModulo(column * 5 + row + variant, 8) < 2
      ? 'vertical'
      : 'horizontal',
  'sateen-weave': (column, row, variant) =>
    positiveModulo(column * 3 - row + variant, 8) < 2
      ? 'horizontal'
      : 'vertical',
  'royal-oxford': (column, row, variant) =>
    positiveModulo(column + row + variant, 4) < 2 ? 'horizontal' : 'vertical',
  curtain: () => 'vertical',
  'two-two-twill': (column, row, variant) =>
    positiveModulo(column - row + variant, 4) < 2 ? 'vertical' : 'horizontal',
  'three-three-twill': (column, row, variant) =>
    positiveModulo(column - row + variant, 6) < 3 ? 'vertical' : 'horizontal',
  herringbone: (column, row, variant) =>
    positiveModulo(
      Math.floor((column + variant) / 2) - Math.floor(row / 2),
      2,
    ) === 0
      ? 'vertical'
      : 'horizontal',
} satisfies Record<LinkPatternFamily, LinkPatternDirectionResolver>

const linkPatternPrimaryResolvers = {
  curtain: (_direction, column, _row, variant) =>
    positiveModulo(column + variant, 3) === 0,
  'royal-oxford': (_direction, column, row, variant) =>
    positiveModulo(column + row + variant, 4) === 0,
  'satin-weave': (direction) => direction === 'vertical',
  'sateen-weave': (direction) => direction === 'horizontal',
  'matt-rib-irregular': (direction) => direction === 'vertical',
  'ens-vertical-pairs': (direction) => direction === 'vertical',
  'basket-weave': (direction) => direction === 'vertical',
  'two-two-twill': (direction) => direction === 'vertical',
  'three-three-twill': (direction) => direction === 'vertical',
  herringbone: (direction) => direction === 'vertical',
} satisfies Record<LinkPatternFamily, LinkPatternPrimaryResolver>

const getLinkPatternDirection = (
  family: LinkPatternFamily,
  column: number,
  row: number,
  variant: number,
): LinkPatternDirection =>
  linkPatternDirectionResolvers[family](column, row, variant)

const getLinkPatternFill = (
  family: LinkPatternFamily,
  direction: LinkPatternDirection,
  column: number,
  row: number,
  variant: number,
  palette: LinkPatternPalette,
): string => {
  const isPrimary = linkPatternPrimaryResolvers[family](
    direction,
    column,
    row,
    variant,
  )

  return isPrimary ? palette.primary : palette.secondary
}

const createLinkPatternRect = (
  column: number,
  row: number,
  direction: LinkPatternDirection,
  fill: string,
): LinkPatternRect => {
  const x = column * LINK_PATTERN_CELL_SIZE
  const y = row * LINK_PATTERN_CELL_SIZE

  if (direction === 'vertical') {
    return {
      x: x + LINK_PATTERN_RECT_INSET,
      y,
      width: LINK_PATTERN_CELL_SIZE - LINK_PATTERN_RECT_INSET * 2,
      height: LINK_PATTERN_CELL_SIZE,
      fill,
    }
  }

  return {
    x,
    y: y + LINK_PATTERN_RECT_INSET,
    width: LINK_PATTERN_CELL_SIZE,
    height: LINK_PATTERN_CELL_SIZE - LINK_PATTERN_RECT_INSET * 2,
    fill,
  }
}

const createLinkPatternRects = (
  family: LinkPatternFamily,
  palette: LinkPatternPalette,
  variant: number,
): LinkPatternRect[] =>
  Array.from(
    { length: LINK_PATTERN_COLUMNS * LINK_PATTERN_COLUMNS },
    (_, i) => {
      const row = Math.floor(i / LINK_PATTERN_COLUMNS)
      const column = i % LINK_PATTERN_COLUMNS
      const direction = getLinkPatternDirection(family, column, row, variant)
      const fill = getLinkPatternFill(
        family,
        direction,
        column,
        row,
        variant,
        palette,
      )

      return createLinkPatternRect(column, row, direction, fill)
    },
  )

const toSvgRect = ({ x, y, width, height, fill }: LinkPatternRect): string =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${LINK_PATTERN_RECT_RADIUS}" fill="${fill}"/>`

const createLinkPatternSvg = (
  family: LinkPatternFamily,
  palette: LinkPatternPalette,
  variant: number,
): string => {
  const rects = createLinkPatternRects(family, palette, variant)
    .map(toSvgRect)
    .join('')

  return `<svg width="${LINK_PATTERN_SIZE}" height="${LINK_PATTERN_SIZE}" viewBox="0 0 ${LINK_PATTERN_SIZE} ${LINK_PATTERN_SIZE}" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="${LINK_PATTERN_SIZE}" height="${LINK_PATTERN_SIZE}" fill="${palette.surface}"/>${rects}</svg>`
}

const toSvgDataUri = (svg: string): string =>
  `data:image/svg+xml,${encodeURIComponent(svg)}`

export const getGeneratedLinkPattern = (href: string): GeneratedLinkPattern => {
  const hash = hashString(href)
  const patternId =
    linkPatternFamilies[hash % linkPatternFamilies.length] ??
    linkPatternFamilies[0]
  const palette =
    linkPatternPalettes[hash % linkPatternPalettes.length] ??
    fallbackLinkPatternPalette
  const variant = Math.floor(hash / 97) % LINK_PATTERN_COLUMNS
  const svg = createLinkPatternSvg(patternId, palette, variant)

  return {
    backgroundImage: `url("${toSvgDataUri(svg)}")`,
    paletteId: palette.id,
    patternId,
    variant,
  }
}
