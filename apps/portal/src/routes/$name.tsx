import { getDnsSecEnabled } from '@ens-apps/utils/dnssec'
import {
  createFileRoute,
  Outlet,
  redirect,
  useParams,
} from '@tanstack/react-router'
import { MobileHeader } from '@/components/MobileHeader'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { PageContainer } from '@/components/PageContainer'
import { ProfileSidebar } from '@/components/ProfileSidebar'
import { SepoliaNoticeBanner } from '@/components/SepoliaNoticeBanner'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { getNameAvailabilityQueryOptions } from '@/features/profile/hooks/useNameAvailability'
import { getNameRegistriesQueryOptions } from '@/features/registry/hooks/useNameRegistryDiscovery'
import { isRegistrable, isTLD } from '@/utils/ens/tldHelpers'
import { queryClient } from '@/utils/queryClient'
import { isValidEnsName } from '@/utils/token/isNormalized'
import type { ProtocolVersion } from '@/utils/types'

export const Route = createFileRoute('/$name')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  beforeLoad: async ({ params }) => {
    const { name } = params

    // Redirect valid TLDs to the dedicated /tld/$tld route
    if (isValidEnsName(name) && isTLD(name)) {
      const shouldRedirect =
        name === 'eth' || (await getDnsSecEnabled(name)) === true
      if (shouldRedirect) {
        throw redirect({ to: '/tld/$tld', params: { tld: name } })
      }
    }

    const ownerData = await queryClient.fetchQuery(
      getEnsOwnerQueryOptions({ name }),
    )
    return {
      protocolVersion: ownerData?.protocolVersion as
        | ProtocolVersion
        | undefined,
    }
  },
  loader: ({ params }) =>
    Promise.all([
      queryClient.prefetchQuery(
        getNameRegistriesQueryOptions({ name: params.name }),
      ),
      ...(isRegistrable(params.name)
        ? [
            queryClient.prefetchQuery(
              getNameAvailabilityQueryOptions({ name: params.name }),
            ),
          ]
        : []),
    ]),
})

function RouteComponent() {
  const { name } = useParams({ from: '/$name' })
  return (
    <SidebarProvider>
      <ProfileSidebar name={name} />
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
