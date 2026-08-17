import {
  SiDiscord,
  SiFarcaster,
  SiGithub,
  SiInstagram,
  SiMastodon,
  SiReddit,
  SiTelegram,
  SiTiktok,
  SiTwitch,
  SiX,
  SiYoutube,
} from '@icons-pack/react-simple-icons'
import {
  ClockIcon,
  HouseIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from 'lucide-react'
import { LinkedInIcon } from '../../components/icons/LinkedInIcon'
import { createSocialProfileValueNormalizer } from './social'
import type { SectionData, TextRecordDef } from './types'

export const specialSections = ['contact'] as const

export const sections = {
  social: { label: 'Connect' },
} as const satisfies Record<string, SectionData>

export const staticTextRecords = [
  'name',
  'avatar',
  'header',
  'description',
  'url',
  'theme',
  'language',
  'primary-contact',
  'domains.ens.primary-contacts',
] as const

export const textRecords: TextRecordDef[] = [
  // Social
  {
    key: 'com.twitter',
    section: 'social',
    name: 'X (Twitter)',
    displayPrefix: '@',
    href: 'https://x.com/',
    kind: 'link',
    forceFetch: 'always',
    normalize: createSocialProfileValueNormalizer({
      hosts: ['x.com', 'twitter.com'],
    }),
    icon: SiX,
  },
  {
    key: 'org.telegram',
    section: 'social',
    name: 'Telegram',
    displayPrefix: '@',
    href: 'https://t.me/',
    kind: 'link',
    forceFetch: 'always',
    normalize: createSocialProfileValueNormalizer({
      hosts: ['t.me', 'telegram.me'],
    }),
    icon: SiTelegram,
  },
  {
    key: 'xyz.farcaster',
    section: 'social',
    name: 'Farcaster',
    displayPrefix: '@',
    href: 'https://farcaster.xyz/',
    kind: 'link',
    forceFetch: 'always',
    normalize: createSocialProfileValueNormalizer({
      hosts: ['farcaster.xyz'],
    }),
    icon: SiFarcaster,
  },
  {
    key: 'com.instagram',
    section: 'social',
    name: 'Instagram',
    displayPrefix: '@',
    kind: 'link',
    href: 'https://instagram.com/',
    normalize: createSocialProfileValueNormalizer({
      hosts: ['instagram.com'],
    }),
    icon: SiInstagram,
  },
  {
    key: 'com.discord',
    section: 'social',
    name: 'Discord',
    kind: 'copy',
    forceFetch: 'always',
    icon: SiDiscord,
  },
  {
    key: 'com.github',
    section: 'social',
    name: 'GitHub',
    kind: 'link',
    href: 'https://github.com/',
    forceFetch: 'always',
    normalize: createSocialProfileValueNormalizer({
      hosts: ['github.com'],
    }),
    icon: SiGithub,
  },
  {
    key: 'com.linkedin',
    section: 'social',
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/in/',
    kind: 'link',
    normalize: createSocialProfileValueNormalizer({
      hosts: ['linkedin.com'],
      pathPrefixes: ['in'],
    }),
    icon: LinkedInIcon,
  },
  {
    key: 'com.youtube',
    section: 'social',
    name: 'YouTube',
    kind: 'link',
    href: 'https://youtube.com/',
    icon: SiYoutube,
  },
  {
    key: 'com.reddit',
    section: 'social',
    name: 'Reddit',
    displayPrefix: 'u/',
    kind: 'link',
    href: 'https://reddit.com/user/',
    normalize: createSocialProfileValueNormalizer({
      hosts: ['reddit.com'],
      pathPrefixes: ['user'],
    }),
    icon: SiReddit,
  },
  {
    key: 'com.tiktok',
    section: 'social',
    name: 'TikTok',
    displayPrefix: '@',
    kind: 'link',
    href: 'https://www.tiktok.com/@',
    normalize: createSocialProfileValueNormalizer({
      hosts: ['tiktok.com'],
    }),
    icon: SiTiktok,
  },
  {
    key: 'com.twitch',
    section: 'social',
    name: 'Twitch',
    kind: 'link',
    href: 'https://twitch.tv/',
    normalize: createSocialProfileValueNormalizer({
      hosts: ['twitch.tv'],
    }),
    icon: SiTwitch,
  },
  {
    key: 'com.mastodon',
    section: 'social',
    name: 'Mastodon',
    kind: 'copy',
    icon: SiMastodon,
  },

  // Contact
  {
    key: 'email',
    section: 'contact',
    name: 'Email Address',
    kind: 'link',
    href: 'mailto:',
    forceFetch: 'always',
    icon: MailIcon,
  },
  {
    key: 'location',
    section: 'contact',
    name: 'Location',
    kind: 'copy',
    icon: MapPinIcon,
  },
  {
    key: 'phone',
    section: 'contact',
    name: 'Phone Number',
    kind: 'link',
    href: 'tel:',
    forceFetch: 'always',
    icon: PhoneIcon,
  },
  {
    key: 'mail',
    section: 'contact',
    name: 'Mailing Address',
    kind: 'copy',
    icon: HouseIcon,
  },
  {
    key: 'timezone',
    section: 'contact',
    name: 'Timezone',
    kind: 'copy',
    icon: ClockIcon,
  },
]
