import { Trans } from '@lingui/react/macro'
import { LinkButton } from '@/components/ens-consumer/button/LinkButton'
import { MSymbol } from '@/components/ui/material-symbol'
import { UnreadBadge } from './UnreadBadge'

type NotificationsMenuItemProps = {
  readonly onAction: () => void
}

export const NotificationsMenuItem = ({
  onAction,
}: NotificationsMenuItemProps) => {
  return (
    <div className="space-y-4 border-ens-quartz-100 border-b p-3 font-normal text-ens-quartz-500 transition-all">
      <div className="flex items-center gap-2">
        <MSymbol className="ms-opsz-20" symbol="notifications_unread" />
        <span className="text-base">
          <Trans>Notifications</Trans>
        </span>
      </div>
      <div className="flex justify-evenly">
        <LinkButton
          className="gap-3 font-[450] capitalize"
          color="temp-light-gray-ghost"
          onClick={() => onAction?.()}
          size="temp-xxs"
          to="/notifications"
        >
          <Trans>Inbox</Trans>
          <UnreadBadge />
        </LinkButton>
        <LinkButton
          className="gap-1.5 font-[450] capitalize"
          color="temp-light-gray-ghost"
          onClick={() => onAction?.()}
          size="temp-xxs"
          to="/notifications/settings"
        >
          <MSymbol className="ms-opsz-20 ms-wght-300" symbol="settings" />
          <Trans>Settings</Trans>
        </LinkButton>
      </div>
    </div>
  )
}
