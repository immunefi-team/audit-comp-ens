import { tw } from '@/utils/tailwind'
import { useUnreadNotificationsCount } from './useUnreadNotificationsCount'

type UnreadBadgeProps = {
  readonly className?: string
}

export const UnreadBadge = ({ className }: UnreadBadgeProps) => {
  const unreadCountQuery = useUnreadNotificationsCount()

  if (!unreadCountQuery.data || unreadCountQuery.data === 0) return null

  return (
    <div
      className={tw(
        'size-fit rounded-full bg-ens-signal-danger-100 px-1.5 py-0.75 text-ens-signal-danger-600 text-sm leading-ens-none',
        className,
      )}
    >
      {unreadCountQuery.data}
    </div>
  )
}

export const UnreadDot = ({ className }: UnreadBadgeProps) => {
  const unreadCountQuery = useUnreadNotificationsCount()

  if (!unreadCountQuery.data || unreadCountQuery.data === 0) return null

  return (
    <div
      className={tw(
        'size-3 rounded-full bg-ens-signal-danger-500 md:size-3.5',
        className,
      )}
    />
  )
}
