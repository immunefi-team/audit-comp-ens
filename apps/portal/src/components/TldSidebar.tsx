import { Link } from '@tanstack/react-router'
import {
  CardsStackIcon,
  HistoryIcon,
  HubIcon,
  KeyIcon,
  TollIcon,
} from '@/assets/icons'
import { LogoSVG, LogoWithTextSVG } from '@/assets/logo'
import { SoonBadge } from '@/components/ui/badge'
import { HomeSearchInput } from '@/features/dashboard/components/HomeSearchInput'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { createDefineLinkItem } from '@/utils/tsr'
import { SettingsMenu } from './SettingsMenu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from './ui/sidebar'
import { WalletMenu } from './WalletMenu'

type SidebarItemData = {
  title: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
  upcoming?: boolean
}

const defineTldSidebarItem = createDefineLinkItem<SidebarItemData>()

const getItems = (tld: string) => [
  defineTldSidebarItem({
    title: 'Records',
    icon: CardsStackIcon,
    disabled: true,
    upcoming: true,
    link: {
      to: '/tld/$tld',
      params: { tld },
    },
  }),
  defineTldSidebarItem({
    title: 'Roles',
    icon: KeyIcon,
    disabled: true,
    upcoming: true,
    link: {
      to: '/tld/$tld',
      params: { tld },
    },
  }),
  defineTldSidebarItem({
    title: 'Registry',
    icon: HubIcon,
    disabled: true,
    upcoming: true,
    link: {
      to: '/tld/$tld',
      params: { tld },
    },
  }),
  defineTldSidebarItem({
    title: 'Token info',
    icon: TollIcon,
    disabled: true,
    upcoming: true,
    link: {
      to: '/tld/$tld',
      params: { tld },
    },
  }),
  defineTldSidebarItem({
    title: 'History',
    icon: HistoryIcon,
    disabled: true,
    upcoming: true,
    link: {
      to: '/tld/$tld',
      params: { tld },
    },
  }),
]

interface TldSidebarProps {
  tld: string
}

export const TldSidebar = ({ tld }: TldSidebarProps) => {
  const items = getItems(tld)
  const { state, isMobile, setOpenMobile } = useSidebar()
  const isIconMode = state === 'collapsed' && !isMobile

  return (
    <Sidebar collapsible="icon">
      <SidebarRail />
      <SidebarTrigger className="hidden group-data-[collapsible=icon]:flex absolute right-0 translate-x-full top-6 z-50 bg-secondary hover:bg-quartz-100 border border-border rounded-r-md shadow-sm" />
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

      <SidebarSeparator className="my-6 self-center data-[orientation=horizontal]:w-[calc(100%-3rem)] group-data-[collapsible=icon]:data-[orientation=horizontal]:w-8" />

      <SidebarContent className="gap-3">
        {/* TLD name section */}
        <div className="px-6 flex flex-col gap-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:items-center">
          <Link
            to="/tld/$tld"
            params={{ tld }}
            activeProps={{ 'data-active': 'true' }}
            activeOptions={{ exact: true }}
            onClick={() => setOpenMobile(false)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 outline-hidden ring-sidebar-ring hover:bg-sidebar-accent focus-visible:ring-2 data-[active=true]:bg-sidebar-accent group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-1"
          >
            <NameAvatar
              name={tld}
              height="24px"
              width="24px"
              rounded="rounded-xs"
            />
            <span className="group-data-[collapsible=icon]:hidden text-base font-medium text-foreground break-all leading-tight">
              {tld}
            </span>
          </Link>
        </div>

        <SidebarGroup className="px-6 py-0 group-data-[collapsible=icon]:px-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-3">
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.disabled || item.upcoming ? (
                    <SidebarMenuButton
                      disabled
                      className="opacity-50 cursor-not-allowed"
                      tooltip={item.title}
                    >
                      <item.icon className="size-4" />
                      <span className="text-sm">{item.title}</span>
                      {item.upcoming && <SoonBadge />}
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link
                        {...item.link}
                        activeProps={{
                          'data-active': 'true',
                        }}
                      >
                        <item.icon className="size-4" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="my-6 self-center data-[orientation=horizontal]:w-[calc(100%-3rem)]" />

      <SidebarFooter className="px-6 pb-6 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-4 group-data-[collapsible=icon]:flex-col-reverse group-data-[collapsible=icon]:gap-3.5">
          <div className="flex-1 group-data-[collapsible=icon]:flex-none">
            <WalletMenu />
          </div>
          <SettingsMenu />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
