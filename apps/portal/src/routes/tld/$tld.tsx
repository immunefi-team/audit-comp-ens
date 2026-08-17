import { createFileRoute, Outlet, useParams } from '@tanstack/react-router'
import { MobileHeader } from '@/components/MobileHeader'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { PageContainer } from '@/components/PageContainer'
import { SepoliaNoticeBanner } from '@/components/SepoliaNoticeBanner'
import { TldSidebar } from '@/components/TldSidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export const Route = createFileRoute('/tld/$tld')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

function RouteComponent() {
  const { tld } = useParams({ from: '/tld/$tld' })
  return (
    <SidebarProvider>
      <TldSidebar tld={tld} />
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
