import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { type Address, checksumAddress, isAddress } from 'viem'
import { MobileHeader } from '@/components/MobileHeader'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { PageContainer } from '@/components/PageContainer'
import { ResolverSidebar } from '@/components/ResolverSidebar'
import { SepoliaNoticeBanner } from '@/components/SepoliaNoticeBanner'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export const Route = createFileRoute('/resolver/$address')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  beforeLoad: (ctx) => {
    if (!isAddress(ctx.params.address, { strict: false })) {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  const { address } = Route.useParams()
  return (
    <SidebarProvider>
      <ResolverSidebar
        address={checksumAddress(address as Address) as Address}
      />
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
