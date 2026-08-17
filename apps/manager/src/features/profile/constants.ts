export const AVATAR_UPLOAD_BASE_URL =
  'https://avatar-upload-staging.ens-cf.workers.dev'

/**
 * Hardcoded reverse map from a known agent-registry contract (chain + address)
 * to its human-readable primary name.
 *
 * ERC-7828 cross-chain name resolution is out of scope (WEB-569 req 7), so the
 * known `8004.eth` registry is hardcoded as an acceptable short-term solution.
 */
export interface KnownAgentRegistry {
  name: string
  chainId: number
  address: string
}

export const KNOWN_AGENT_REGISTRIES: readonly KnownAgentRegistry[] = [
  {
    name: '8004.eth',
    chainId: 1,
    address: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
  },
]

/**
 * Looks up a known registry name by chain ID and address.
 *
 * @param chainId - The EVM chain ID
 * @param address - The registry contract address
 * @returns The registry name (e.g. "8004.eth") or null if unknown
 */
export function getKnownRegistryName(
  chainId: number,
  address: string,
): string | null {
  const normalizedAddress = address.toLowerCase()
  const registry = KNOWN_AGENT_REGISTRIES.find(
    (r) =>
      r.chainId === chainId && r.address.toLowerCase() === normalizedAddress,
  )
  return registry?.name ?? null
}

export const PROFILE_THEMES = [
  {
    aliases: ['#000000', '#191919'],
    buttonTextColor: '#02293B',
    label: 'Quartz',
    preview: {
      activeRingClassName: 'ring-ens-quartz-350',
      addressClassName: 'text-ens-quartz-500',
      backgroundImage:
        'linear-gradient(185deg, var(--color-ens-quartz-75) 7%, var(--color-ens-quartz-200) 146%)',
      badgeClassName: 'bg-ens-lapis-900',
      badgeTextClassName: 'text-[#f6fbfd]',
    },
    value: '#02293B',
  },
  {
    aliases: ['#ED2496'],
    buttonTextColor: '#5A0024',
    label: 'Garnet',
    preview: {
      activeRingClassName: 'ring-ens-garnet-400',
      addressClassName: 'text-ens-garnet-900',
      backgroundImage:
        'linear-gradient(185deg, var(--color-ens-garnet-100) 7%, var(--color-ens-garnet-200) 146%)',
      badgeClassName: 'bg-ens-garnet-500',
      badgeTextClassName: 'text-[#fdf1f5]',
    },
    value: '#E72A96',
  },
  {
    aliases: ['#0080BC'],
    buttonTextColor: '#02293B',
    label: 'Lapis',
    preview: {
      activeRingClassName: 'ring-ens-lapis-400',
      addressClassName: 'text-ens-lapis-900',
      backgroundImage:
        'linear-gradient(185deg, var(--color-ens-lapis-bg) 7%, #a3e0fd 146%)',
      badgeClassName: 'bg-ens-lapis-500',
      badgeTextClassName: 'text-[#f6fbfd]',
    },
    value: '#0082BB',
  },
  {
    aliases: ['#007C23'],
    buttonTextColor: '#033010',
    label: 'Peridot',
    preview: {
      activeRingClassName: 'ring-ens-peridot-400',
      addressClassName: 'text-ens-peridot-900',
      backgroundImage: 'linear-gradient(185deg, #e4ffe3 7%, #a3fda6 146%)',
      badgeClassName: 'bg-ens-peridot-500',
      badgeTextClassName: 'text-[#e9f7ef]',
    },
    value: '#007C20',
  },
  {
    aliases: [],
    buttonTextColor: '#441B03',
    label: 'Citrine',
    preview: {
      activeRingClassName: 'ring-ens-citrine-400',
      addressClassName: 'text-ens-citrine-900',
      backgroundImage:
        'linear-gradient(185deg, var(--color-ens-citrine-100) 7%, var(--color-ens-citrine-300) 146%)',
      badgeClassName: 'bg-ens-citrine-500',
      badgeTextClassName: 'text-[#fcfcf3]',
    },
    value: '#984D1B',
  },
] as const

export type ProfileTheme = (typeof PROFILE_THEMES)[number]
export type ProfileThemePreview = ProfileTheme['preview']
export type ThemeColorValue = ProfileTheme['value']

export const THEME_COLORS: readonly {
  readonly label: ProfileTheme['label']
  readonly value: ThemeColorValue
}[] = PROFILE_THEMES.map(({ label, value }) => ({ value, label }))

export const DEFAULT_THEME_COLOR: ThemeColorValue = '#0082BB'

export const THEME_COLOR_ALIASES = Object.fromEntries(
  PROFILE_THEMES.flatMap((theme) =>
    theme.aliases.map((alias) => [alias, theme.value]),
  ),
) as Record<string, ThemeColorValue>
