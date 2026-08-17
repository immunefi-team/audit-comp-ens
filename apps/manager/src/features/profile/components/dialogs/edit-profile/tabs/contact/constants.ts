import type { HTMLInputTypeAttribute } from 'react'

export const primaryContactRecordKey = 'primary-contact'
export const primaryContactsRecordKey = 'domains.ens.primary-contacts'
export const maxPrimaryContactMethods = 3

export const contactMethods = [
  {
    key: 'com.twitter',
    label: 'Twitter',
    placeholder: 'Twitter',
    section: 'social',
  },
  {
    key: 'org.telegram',
    label: 'Telegram',
    placeholder: 'Telegram',
    section: 'social',
  },
  {
    key: 'xyz.farcaster',
    label: 'Farcaster',
    placeholder: 'Farcaster',
    section: 'social',
  },
  {
    key: 'com.discord',
    label: 'Discord',
    placeholder: 'Discord',
    section: 'social',
  },
  {
    key: 'com.instagram',
    label: 'Instagram',
    placeholder: 'Instagram',
    section: 'social',
  },
  {
    key: 'com.linkedin',
    label: 'LinkedIn',
    placeholder: 'LinkedIn',
    section: 'social',
  },
  {
    key: 'com.github',
    label: 'GitHub',
    placeholder: 'GitHub',
    section: 'social',
  },
  {
    key: 'com.mastodon',
    label: 'Mastodon',
    placeholder: 'Mastodon',
    section: 'social',
  },
  {
    key: 'com.reddit',
    label: 'Reddit',
    placeholder: 'Reddit',
    section: 'social',
  },
  {
    key: 'com.tiktok',
    label: 'TikTok',
    placeholder: 'TikTok',
    section: 'social',
  },
  {
    key: 'com.twitch',
    label: 'Twitch',
    placeholder: 'Twitch',
    section: 'social',
  },
  {
    key: 'email',
    label: 'E-mail',
    placeholder: 'myemail@me.com',
    section: 'contact',
    type: 'email',
  },
  {
    key: 'phone',
    label: 'Phone',
    placeholder: 'Phone',
    section: 'contact',
    type: 'tel',
  },
  {
    key: 'mail',
    label: 'Address',
    placeholder: 'Address',
    section: 'contact',
  },
] as const satisfies readonly {
  readonly key: string
  readonly label: string
  readonly placeholder: string
  readonly section: 'contact' | 'social'
  readonly type?: HTMLInputTypeAttribute
}[]

export type ContactMethod = (typeof contactMethods)[number]
export type ContactMethodKey = ContactMethod['key']

export const defaultEnabledContactMethodKeys: ReadonlySet<ContactMethodKey> =
  new Set<ContactMethodKey>(['com.twitter', 'org.telegram'])

const rowMethodKeys = [
  'email',
  'com.twitter',
  'org.telegram',
  'xyz.farcaster',
  'com.discord',
  'com.instagram',
  'com.linkedin',
  'mail',
  'phone',
  'com.github',
  'com.mastodon',
  'com.reddit',
  'com.tiktok',
  'com.twitch',
] as const satisfies readonly ContactMethodKey[]

const contactMethodByKey = new Map(
  contactMethods.map((method) => [method.key, method]),
)

export const contactMethodKeys: ReadonlySet<ContactMethodKey> = new Set(
  contactMethods.map(({ key }) => key),
)

export const rowMethods = rowMethodKeys.map((key) => {
  const method = contactMethodByKey.get(key)
  if (!method) {
    throw new Error(`Unknown contact method key: ${key}`)
  }
  return method
})
