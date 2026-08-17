import { FeatureEnabled } from '@/components/FeatureEnabled'
import { NotificationsMenuItem } from '../notifications/NotificationsMenuItem'
import { LanguageSection } from './LanguageSection'
import { NavSection } from './NavSection'
import { WalletSection } from './WalletSection'

type AccountContentProps = {
  readonly onAction: () => void
}

export const AccountContent = ({ onAction }: AccountContentProps) => {
  return (
    <div className="ms-wght-300 space-y-8">
      <div className="flex flex-col gap-0.5">
        <NavSection onAction={onAction} />
        <NotificationsMenuItem onAction={onAction} />
      </div>
      <FeatureEnabled flag="LANGUAGE_SELECTOR">
        <LanguageSection onAction={onAction} />
      </FeatureEnabled>
      <WalletSection onAction={onAction} />
    </div>
  )
}
