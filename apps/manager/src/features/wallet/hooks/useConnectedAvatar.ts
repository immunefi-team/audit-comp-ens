import { useQuery } from '@tanstack/react-query'
import { buildNameAvatarUrl } from '@/features/profile/service/profileAvatar'
import { profileRecordsQuery } from '@/features/profile/service/profileRecords'
import { getThemeVars } from '@/features/profile/utils/themeColor'
import { useConnectedReverseName } from '@/features/wallet/hooks/useConnectedReverseName'

export const useConnectedAvatar = () => {
  const reverseNameQuery = useConnectedReverseName()
  const name = reverseNameQuery.data ?? undefined
  const profileRecords = useQuery({
    ...profileRecordsQuery(name ?? ''),
    enabled: !!name,
  })
  const savedTheme = profileRecords.data?.texts.find(
    (record) => record.key === 'theme',
  )?.value
  const themeColor = savedTheme
    ? getThemeVars(savedTheme)['--theme-color']
    : undefined

  return {
    url: name ? buildNameAvatarUrl(name) : undefined,
    themeColor,
    isLoading: reverseNameQuery.isLoading,
    error: reverseNameQuery.error ?? profileRecords.error,
  }
}
