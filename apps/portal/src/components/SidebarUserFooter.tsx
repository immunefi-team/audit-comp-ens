import { SettingsMenu } from './SettingsMenu'
import { SidebarFooter } from './ui/sidebar'
import { WalletMenu } from './WalletMenu'

/**
 * Shared sidebar footer: connected-wallet menu + settings. Stacks (wallet below
 * settings) when the sidebar collapses to icon mode.
 */
export const SidebarUserFooter = () => (
  <SidebarFooter className="px-6 pb-6 group-data-[collapsible=icon]:px-2">
    <div className="flex items-center gap-4 group-data-[collapsible=icon]:flex-col-reverse group-data-[collapsible=icon]:gap-3.5">
      <div className="flex-1 group-data-[collapsible=icon]:flex-none">
        <WalletMenu />
      </div>
      <SettingsMenu />
    </div>
  </SidebarFooter>
)
