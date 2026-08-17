const ENS_METADATA_V2_SEPOLIA_URL =
  'https://ens-metadata-v2.ensdomains.workers.dev/sepolia'

const buildNameImageUrl = ({
  kind,
  name,
}: {
  kind: 'avatar' | 'header'
  name: string
}): string => {
  const url = new URL(
    `${ENS_METADATA_V2_SEPOLIA_URL}/${kind}/${encodeURIComponent(name)}`,
  )

  return url.toString()
}

export const buildNameAvatarUrl = (name: string): string =>
  buildNameImageUrl({ kind: 'avatar', name })

export const buildNameHeaderUrl = (name: string): string =>
  buildNameImageUrl({ kind: 'header', name })
