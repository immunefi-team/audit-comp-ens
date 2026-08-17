import { getNotificationActionButtonClass } from '@/features/notifications/shared/primitives'
import { MessageCardTemplate } from '@/features/notifications/shared/templates'
import { safeHttpHref } from '@/features/profile/utils/safeUrl'
import type { KindComponentProps } from './contracts'

export const AlphaWelcomeComponent = ({
  payload,
  seen,
  timestamp,
  layout = 'default',
  onAction,
  onMarkAsRead,
  onRemove,
}: KindComponentProps<'alpha-welcome'>) => {
  const safeCtaUrl = safeHttpHref(payload.ctaUrl)
  return (
    <MessageCardTemplate
      action={
        payload.ctaLabel && safeCtaUrl ? (
          <a
            className={getNotificationActionButtonClass(layout)}
            href={safeCtaUrl}
            onClick={onAction}
            rel="noopener noreferrer"
            target="_blank"
          >
            {payload.ctaLabel}
          </a>
        ) : null
      }
      category="ENS Update"
      categoryTone="update"
      description={payload.body}
      layout={layout}
      onMarkAsRead={onMarkAsRead}
      onRemove={onRemove}
      seen={seen}
      timestamp={timestamp}
      title={payload.title}
    />
  )
}
