import defaultHeaderCoverSvg from '@/assets/profile/default-header-cover.svg?raw'
import type { ProfileTheme } from '../constants'
import { getProfileTheme } from './themeColor'

type CoverKey = ProfileTheme['label'] | 'Grace' | 'Loading'

const COVER_COLORS = {
  Citrine: '#984D1B',
  Garnet: '#E72A96',
  Grace: '#87514C',
  Lapis: '#0082BB',
  Loading: '#C7C6C4',
  Peridot: '#007C20',
  Quartz: '#02293B',
} satisfies Record<CoverKey, string>

const coverCache = new Map<CoverKey, string>()

const buildCover = (key: CoverKey): string => {
  const cachedCover = coverCache.get(key)
  if (cachedCover) return cachedCover

  const svg = defaultHeaderCoverSvg.replace(
    '__COVER_COLOR__',
    COVER_COLORS[key],
  )
  const cover = `data:image/svg+xml,${encodeURIComponent(svg)}`

  coverCache.set(key, cover)
  return cover
}

type GetDefaultHeaderCoverOptions = {
  readonly isInGrace?: boolean
  readonly themeColor?: string | null
}

export const getDefaultHeaderCover = ({
  isInGrace = false,
  themeColor,
}: GetDefaultHeaderCoverOptions): string =>
  buildCover(isInGrace ? 'Grace' : getProfileTheme(themeColor).label)

export const getLoadingHeaderCover = (): string => buildCover('Loading')
