import { createSocialProfileValueNormalizer } from '@/features/profile/data/records/social'

type ResolverTextRecord = {
  readonly key: string
  readonly value: string
}

const LEGACY_RECORD_KEYS = {
  'vnd.twitter': 'com.twitter',
  'vnd.github': 'com.github',
} as const

const normalizeTwitter = createSocialProfileValueNormalizer({
  hosts: [
    'x.com',
    'twitter.com',
    'mobile.x.com',
    'mobile.twitter.com',
    'm.x.com',
    'm.twitter.com',
  ],
})

const normalizeGithub = createSocialProfileValueNormalizer({
  hosts: ['github.com', 'mobile.github.com', 'm.github.com'],
})

const canonicalRecordKey = (key: string): string =>
  LEGACY_RECORD_KEYS[key as keyof typeof LEGACY_RECORD_KEYS] ?? key

const normalizeRecordValue = (key: string, value: string): string => {
  if (key === 'com.twitter') return normalizeTwitter(value)
  if (key === 'com.github') return normalizeGithub(value)
  return value
}

export const cleanResolverTextRecords = (
  records: readonly ResolverTextRecord[],
): readonly ResolverTextRecord[] => {
  const canonicalKeys = new Set(
    records
      .filter(({ key }) => key === 'com.twitter' || key === 'com.github')
      .map(({ key }) => key),
  )

  return records.flatMap(({ key, value }) => {
    const canonicalKey = canonicalRecordKey(key)
    const isLegacyKey = canonicalKey !== key

    if (isLegacyKey && canonicalKeys.has(canonicalKey)) return []

    return [
      {
        key: canonicalKey,
        value: normalizeRecordValue(canonicalKey, value),
      },
    ]
  })
}
