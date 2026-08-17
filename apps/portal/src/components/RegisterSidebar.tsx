import { SidebarBrandHeader } from './SidebarBrandHeader'
import { SidebarUserFooter } from './SidebarUserFooter'
import {
  Sidebar,
  SidebarContent,
  SidebarRail,
  SidebarTrigger,
} from './ui/sidebar'

/**
 * Sidebar for the registration flow — the shared brand header (logo + search)
 * and user footer (wallet + settings) with no entity sub-navigation, since
 * registration isn't scoped to a name/address.
 */
export const RegisterSidebar = () => (
  <Sidebar collapsible="icon">
    <SidebarRail />
    <SidebarTrigger className="hidden group-data-[collapsible=icon]:flex absolute right-0 translate-x-full top-6 z-50 bg-secondary hover:bg-quartz-100 border border-border rounded-r-md shadow-sm" />
    <SidebarBrandHeader />
    <SidebarContent />
    <SidebarUserFooter />
  </Sidebar>
)
