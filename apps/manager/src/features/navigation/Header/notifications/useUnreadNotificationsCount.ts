import { useQuery } from '@tanstack/react-query'
import { useAtom } from '@xstate/store-react'
import { unreadCountQuery } from '@/features/notifications/data/queries/notifications'
import { isBackendAuthed } from '@/utils/backend-client'

export const useUnreadNotificationsCount = () => {
  const isAuthed = useAtom(isBackendAuthed)

  return useQuery({
    ...unreadCountQuery,
    enabled: isAuthed,
    select: (data) => data.unreadCount,
  })
}
