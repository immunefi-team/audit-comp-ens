const ENS_METADATA_SEPOLIA_AVATAR_URL =
  'https://metadata.ens.domains/sepolia/avatar'

export const getMigrationAvatarUrl = (name: string): string =>
  `${ENS_METADATA_SEPOLIA_AVATAR_URL}/${encodeURIComponent(name)}`
