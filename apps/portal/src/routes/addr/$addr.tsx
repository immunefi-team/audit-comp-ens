import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { type Address, checksumAddress, isAddress } from 'viem'
import { AddrSidebar } from '@/components/AddrSidebar'
import { MobileHeader } from '@/components/MobileHeader'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { PageContainer } from '@/components/PageContainer'
import { SepoliaNoticeBanner } from '@/components/SepoliaNoticeBanner'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export const Route = createFileRoute('/addr/$addr')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  beforeLoad: (ctx) => {
    if (!isAddress(ctx.params.addr, { strict: false })) {
      throw redirect({ to: '/$name', params: { name: ctx.params.addr } })
    }
  },
})

function RouteComponent() {
  const { addr } = Route.useParams()
  return (
    <SidebarProvider>
      <AddrSidebar addr={checksumAddress(addr as Address)} />
      <SidebarInset className="w-full min-w-0">
        <MobileHeader />
        <SepoliaNoticeBanner />
        <PageContainer>
          <Outlet />
        </PageContainer>
      </SidebarInset>
    </SidebarProvider>
  )
}
