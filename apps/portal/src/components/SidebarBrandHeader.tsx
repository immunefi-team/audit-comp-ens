import { Link } from '@tanstack/react-router'
import { LogoSVG, LogoWithTextSVG } from '@/assets/logo'
import { HomeSearchInput } from '@/features/dashboard/components/HomeSearchInput'
import { SidebarHeader, SidebarTrigger, useSidebar } from './ui/sidebar'

/**
 * Shared sidebar header: ENS logo + global search, collapsing to icon-only when
 * the sidebar is in icon mode. Used by every app sidebar.
 */
export const SidebarBrandHeader = () => {
  const { state, isMobile } = useSidebar()
  const isIconMode = state === 'collapsed' && !isMobile

  return (
    <SidebarHeader className="p-0 gap-0">
      {isIconMode ? (
        <div className="flex flex-col items-center gap-4 pt-6 px-2">
          <Link
            to="/"
            className="flex items-center min-h-8"
            aria-label="ENS Home"
          >
            <LogoSVG height={30} className="text-foreground" />
          </Link>
          <HomeSearchInput iconOnly />
        </div>
      ) : (
        <div className="px-6 pt-6 flex flex-col gap-6">
          <div className="flex items-center min-h-8">
            <Link to="/" className="flex items-center">
              <LogoWithTextSVG
                width={97}
                height={30}
                className="text-foreground"
              />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <HomeSearchInput />
            </div>
            <SidebarTrigger className="shrink-0" />
          </div>
        </div>
      )}
    </SidebarHeader>
  )
}
