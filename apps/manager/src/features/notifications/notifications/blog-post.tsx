import { getNotificationActionButtonClass } from '@/features/notifications/shared/primitives'
import { ContentCardTemplate } from '@/features/notifications/shared/templates'
import { safeHttpHref } from '@/features/profile/utils/safeUrl'
import type { KindComponentProps } from './contracts'

export const BlogPostComponent = ({
  payload,
  seen,
  timestamp,
  layout = 'default',
  onAction,
  onMarkAsRead,
  onRemove,
}: KindComponentProps<'blog-post'>) => {
  const postHref = safeHttpHref(payload.url)
  return (
    <ContentCardTemplate
      action={
        postHref ? (
          <a
            className={getNotificationActionButtonClass(layout)}
            href={postHref}
            onClick={onAction}
            rel="noopener noreferrer"
            target="_blank"
          >
            Go to post
          </a>
        ) : null
      }
      category="ENS Update"
      categoryTone="update"
      imageUrl={safeHttpHref(payload.imageUrl)}
      layout={layout}
      onMarkAsRead={onMarkAsRead}
      onRemove={onRemove}
      seen={seen}
      timestamp={timestamp}
      title={payload.title}
    />
  )
}
