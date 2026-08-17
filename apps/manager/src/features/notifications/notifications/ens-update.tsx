import { getNotificationActionButtonClass } from '@/features/notifications/shared/primitives'
import { MessageCardTemplate } from '@/features/notifications/shared/templates'
import { safeHttpHref } from '@/features/profile/utils/safeUrl'
import type { KindComponentProps } from './contracts'

export const EnsUpdateComponent = ({
  payload,
  seen,
  timestamp,
  layout = 'default',
  onAction,
  onMarkAsRead,
  onRemove,
}: KindComponentProps<'ens-update'>) => {
  const safeUrl = safeHttpHref(payload.url)
  return (
    <MessageCardTemplate
      action={
        safeUrl ? (
          <a
            className={getNotificationActionButtonClass(layout)}
            href={safeUrl}
            onClick={onAction}
            rel="noopener noreferrer"
            target="_blank"
          >
            Read more
          </a>
        ) : null
      }
      category="ENS Update"
      categoryTone="update"
      description={payload.summary}
      layout={layout}
      onMarkAsRead={onMarkAsRead}
      onRemove={onRemove}
      seen={seen}
      timestamp={timestamp}
      title={payload.title}
    />
  )
}
