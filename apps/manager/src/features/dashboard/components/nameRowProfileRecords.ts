import { buildNameAvatarUrl } from '@/features/profile/service/profileAvatar'
import type { ProfileRecordsResult } from '@/features/profile/service/profileRecords'

export type NameRowProfilePreview = {
  readonly themeColor?: string
  readonly avatarUrl?: string
  readonly isAvatarPending: boolean
}

const getTextRecordValue = (
  records: ProfileRecordsResult | null | undefined,
  key: string,
): string | undefined => {
  const value = records?.texts.find((text) => text.key === key)?.value.trim()
  return value ? value : undefined
}

export const getNameRowProfilePreview = (params: {
  readonly label: string
  readonly name?: string
  readonly records?: ProfileRecordsResult | null
  readonly isLoading?: boolean
}): NameRowProfilePreview => {
  const themeColor = getTextRecordValue(params.records, 'theme')
  const avatarRecord = getTextRecordValue(params.records, 'avatar')
  const avatarName = params.name ?? params.label

  return {
    avatarUrl: avatarRecord ? buildNameAvatarUrl(avatarName) : undefined,
    themeColor,
    isAvatarPending: params.isLoading === true && !params.records,
  }
}
