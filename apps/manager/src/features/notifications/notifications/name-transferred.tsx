import { getNotificationActionButtonClass } from '@/features/notifications/shared/primitives'
import { NameCardTemplate } from '@/features/notifications/shared/templates'
import type { KindComponent } from './contracts'

export const NameTransferredComponent: KindComponent<'name-transferred'> = ({
  payload,
  seen,
  timestamp,
  layout = 'default',
  onAction,
  onMarkAsRead,
  onRemove,
}) => (
  <NameCardTemplate
    action={
      <a
        className={getNotificationActionButtonClass(layout)}
        href={`https://etherscan.io/tx/${payload.txHash}`}
        onClick={onAction}
        rel="noopener noreferrer"
        target="_blank"
      >
        View tx
      </a>
    }
    category="Activity"
    categoryTone="default"
    layout={layout}
    name={payload.name}
    onMarkAsRead={onMarkAsRead}
    onRemove={onRemove}
    seen={seen}
    statusText="Transferred"
    timestamp={timestamp}
  />
)
