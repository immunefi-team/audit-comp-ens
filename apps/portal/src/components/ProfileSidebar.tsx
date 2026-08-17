import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { FlameIcon, WalletIcon } from 'lucide-react'
import {
  CardsStackIcon,
  GraphIcon,
  HistoryIcon,
  HubIcon,
  KeyIcon,
  ResolverIcon,
  ShieldIcon,
  TollIcon,
} from '@/assets/icons'
import { LogoSVG, LogoWithTextSVG } from '@/assets/logo'
import { SoonBadge } from '@/components/ui/badge'
import { HomeSearchInput } from '@/features/dashboard/components/HomeSearchInput'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { getNameAvailabilityQueryOptions } from '@/features/profile/hooks/useNameAvailability'
import { isRegistrable } from '@/utils/ens/tldHelpers'
import { createDefineLinkItem } from '@/utils/tsr'
import type { ProtocolVersion } from '@/utils/types'
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

const defineProfileSidebarItem = createDefineLinkItem<SidebarItemData>()

const getItems = (name: string, protocolVersion?: ProtocolVersion) => [
  defineProfileSidebarItem({
    title: 'Address Resolution',
    icon: WalletIcon,
    link: {
      to: '/$name/address',
      params: { name },
    },
  }),
  defineProfileSidebarItem({
    title: 'Records',
    icon: CardsStackIcon,
    link: {
      to: '/$name/records',
      params: { name },
    },
  }),
  defineProfileSidebarItem({
    title: 'Resolver',
    icon: ResolverIcon,
    link: {
      to: '/$name/resolver',
      params: { name },
    },
  }),
  defineProfileSidebarItem({
    title: 'Ownership',
    icon: KeyIcon,
    link: {
      to: '/$name/ownership',
      params: { name },
    },
  }),
  ...(protocolVersion === 'ENSv2'
    ? [
        defineProfileSidebarItem({
          title: 'Roles',
          icon: ShieldIcon,
          link: {
            to: '/$name/roles',
            params: { name },
          },
        }),
      ]
    : [
        defineProfileSidebarItem({
          title: 'Fuses',
          icon: FlameIcon,
          link: {
            to: '/$name/fuses',
            params: { name },
          },
        }),
      ]),
  defineProfileSidebarItem({
    title: 'Subnames',
    icon: GraphIcon,
    link: {
      to: '/$name/subnames',
      params: { name },
    },
  }),
  defineProfileSidebarItem({
    title: 'Registry',
    icon: HubIcon,
    link: {
      to: '/$name/registry',
      params: { name },
    },
  }),
  defineProfileSidebarItem({
    title: 'Token info',
    icon: TollIcon,
    link: {
      to: '/$name/token',
      params: { name },
    },
  }),
  defineProfileSidebarItem({
    title: 'History',
    icon: HistoryIcon,
    link: {
      to: '/$name/history',
      params: { name },
    },
  }),
]

interface ProfileSidebarProps {
  name: string
}

export const ProfileSidebar = ({ name }: ProfileSidebarProps) => {
  const { data: ownerData } = useQuery(getEnsOwnerQueryOptions({ name }))
  const { data: availability } = useQuery({
    ...getNameAvailabilityQueryOptions({ name }),
    enabled: isRegistrable(name),
  })
  const protocolVersion = ownerData?.protocolVersion
  const items = getItems(name, protocolVersion)
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

      <SidebarSeparator className="mt-6 self-center data-[orientation=horizontal]:w-[calc(100%-3rem)] group-data-[collapsible=icon]:data-[orientation=horizontal]:w-8" />

      <SidebarContent className="gap-3 py-6">
        {/* Name section */}
        <div className="px-6 flex flex-col gap-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:items-center">
          <Link
            to="/$name"
            params={{ name }}
            activeProps={{ 'data-active': 'true' }}
            activeOptions={{ exact: true }}
            onClick={() => setOpenMobile(false)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 outline-hidden ring-sidebar-ring hover:bg-sidebar-accent focus-visible:ring-2 data-[active=true]:bg-sidebar-accent group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-1"
          >
            <NameAvatar
              name={name}
              height="24px"
              width="24px"
              rounded="rounded-xs"
            />
            <span className="group-data-[collapsible=icon]:hidden text-base font-medium text-foreground break-all leading-tight">
              {name}
            </span>
          </Link>
        </div>

        {!availability?.isAvailable && (
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
        )}
      </SidebarContent>

      <SidebarSeparator className="self-center data-[orientation=horizontal]:w-[calc(100%-3rem)] group-data-[collapsible=icon]:data-[orientation=horizontal]:w-8" />

      <SidebarFooter className="px-6 py-6 group-data-[collapsible=icon]:px-2">
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
