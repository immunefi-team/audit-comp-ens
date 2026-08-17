import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { AVATAR_UPLOAD_BASE_URL } from '@/features/profile/constants'
import type { ProfileRecords } from '@/features/profile/types'
import type { ImageType } from './profileImageUpload'
import { profileRecordsQuery } from './profileRecords'

export interface SignedProfileImageUpload {
  readonly kind: ImageType
  readonly imageUrl: string
}

interface RefreshProfileImageCachesParams {
  readonly images: readonly SignedProfileImageUpload[]
  readonly name: string
  readonly queryClient: QueryClient
}

const getQueryMeta = (queryKey: QueryKey): Record<string, unknown> | null => {
  const [meta] = queryKey

  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return null
  }

  return meta as Record<string, unknown>
}

const getQueryMetaString = (
  queryKey: QueryKey,
  key: string,
): string | undefined => {
  const value = getQueryMeta(queryKey)?.[key]
  return typeof value === 'string' ? value : undefined
}

const normalizeImageUrl = (imageUrl: string) => imageUrl.trim()

const isGaslessProfileImageUrl = (imageUrl: string) =>
  normalizeImageUrl(imageUrl).startsWith(AVATAR_UPLOAD_BASE_URL)

const getCacheBustedImageUrl = (imageUrl: string, version: number) => {
  const normalizedImageUrl = normalizeImageUrl(imageUrl)

  if (!isGaslessProfileImageUrl(normalizedImageUrl)) {
    return imageUrl
  }

  const url = new URL(normalizedImageUrl)
  url.searchParams.set('v', String(version))
  return url.toString()
}

export const getActiveSignedProfileImageUploads = <
  TImage extends SignedProfileImageUpload,
>({
  images,
  records,
}: {
  readonly images: readonly TImage[]
  readonly records: ProfileRecords
}) =>
  images.filter(
    ({ imageUrl, kind }) =>
      normalizeImageUrl(records.base[kind] ?? '') ===
      normalizeImageUrl(imageUrl),
  )

const refreshParsedAvatarCaches = ({
  images,
  queryClient,
  version,
}: {
  readonly images: readonly SignedProfileImageUpload[]
  readonly queryClient: QueryClient
  readonly version: number
}) => {
  const imageUrlByRecord = new Map(
    images.map(({ imageUrl }) => [
      normalizeImageUrl(imageUrl),
      getCacheBustedImageUrl(imageUrl, version),
    ]),
  )

  for (const query of queryClient.getQueryCache().findAll({
    queryKey: $qk({ $scope: 'profile', $action: 'image_record' }),
  })) {
    const record = getQueryMetaString(query.queryKey, 'record')
    const imageUrl = record
      ? imageUrlByRecord.get(normalizeImageUrl(record))
      : undefined

    if (imageUrl) {
      queryClient.setQueryData(query.queryKey, imageUrl)
    }
  }
}

export const refreshProfileImageCaches = async ({
  images,
  name,
  queryClient,
}: RefreshProfileImageCachesParams) => {
  const gaslessImages = images.filter(({ imageUrl }) =>
    isGaslessProfileImageUrl(imageUrl),
  )

  if (gaslessImages.length === 0) {
    return
  }

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: profileRecordsQuery(name).queryKey,
    }),
    queryClient.invalidateQueries({
      queryKey: $qk({ $scope: 'profile', $action: 'image_record' }),
    }),
  ])

  const version = Date.now()
  refreshParsedAvatarCaches({
    images: gaslessImages,
    queryClient,
    version,
  })
}
