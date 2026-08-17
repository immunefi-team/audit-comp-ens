import { useQuery } from '@tanstack/react-query'
import { unreadCountQuery } from '@/features/notifications/data/queries/notifications'
import { tw } from '@/utils/tailwind'

export const UnreadCount = () => {
  const unread = useQuery(unreadCountQuery)

  if (!unread.data) return null

  return (
    <div
      className={tw(
        'rounded-full px-1.5 py-0.5 font-medium text-sm leading-ens-tight',
        unread.data?.unreadCount > 0
          ? 'bg-ens-lapis-dust text-ens-lapis-core'
          : 'bg-ens-white text-[#7D7D7D]',
      )}
    >
      {unread.data?.unreadCount ?? 0}
    </div>
  )
}
