import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Clock, GridIcon, SplitIcon, UserRoundCog } from 'lucide-react'
import type { Address } from 'viem'
import { sepolia } from 'viem/chains'
import { CounterCard, CounterCardRow } from '@/components/CounterCard'
import { ErrorMessage } from '@/components/ErrorMessage'
import { HistorySectionHeader } from '@/components/HistorySectionHeader'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { Button } from '@/components/ui/button'
import { ResolverDetails } from '@/features/resolver/components/ResolverDetails'
import { ResolverEventsTable } from '@/features/resolver/components/ResolverEventsTable'
import { ResolverTypeValue } from '@/features/resolver/components/ResolverTypeValue'
import { getResolverOverviewQueryOptions } from '@/features/resolver/hooks/useResolverOverview'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import { queryClient } from '@/utils/queryClient'
import type { HttpsUrl } from '@/utils/types'

export const Route = createFileRoute('/resolver/$address/')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  loader: ({ params }) => {
    return queryClient.prefetchQuery(
      getResolverOverviewQueryOptions({
        address: params.address as Address,
      }),
    )
  },
})

const sepoliaUrl = sepolia.blockExplorers.default.url
const RECENT_EVENT_LIMIT = 5

function RouteComponent() {
  const { address } = Route.useParams()

  const {
    data: resolver,
    isLoading,
    error,
  } = useQuery(getResolverOverviewQueryOptions({ address: address as Address }))

  const recentEvents = (resolver?.events ?? [])
    .toSorted(
      (a, b) => (b.timestamp ?? b.blockNumber) - (a.timestamp ?? a.blockNumber),
    )
    .slice(0, RECENT_EVENT_LIMIT)

  if (isLoading) return <LoadingMessage />

  if (error)
    return (
      <ErrorMessage
        title="Resolver unavailable"
        description={error.cause?.message}
      />
    )

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h2 md:text-h1">
        Resolver {truncateAddress(address, 6, 4, '...')}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CounterCard to="/resolver/$address/nodes" params={{ address }}>
          <CounterCardRow icon={GridIcon}>
            <span className="font-medium">{resolver?.nodeCount ?? 0}</span>{' '}
            nodes
          </CounterCardRow>
        </CounterCard>

        <CounterCard to="/resolver/$address/roles" params={{ address }}>
          <CounterCardRow icon={UserRoundCog}>
            <span className="font-medium">
              {resolver?.roleHolderCount ?? 0}
            </span>{' '}
            roles
          </CounterCardRow>
        </CounterCard>

        <CounterCard to="/resolver/$address/aliases" params={{ address }}>
          <CounterCardRow icon={SplitIcon}>
            <span className="font-medium">{resolver?.aliasCount ?? 0}</span>{' '}
            aliases
          </CounterCardRow>
        </CounterCard>
      </div>

      <ResolverDetails
        resolverAddress={address as Address}
        typeValue={<ResolverTypeValue resolverAddress={address as Address} />}
        data={[
          {
            label: 'Contract',
            value: address,
            href: `${sepoliaUrl}/address/${address}` as HttpsUrl,
          },
        ]}
      />

      <div className="flex flex-col gap-4 w-full">
        <HistorySectionHeader
          action={
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-7"
              asChild
            >
              <Link to="/resolver/$address/history" params={{ address }}>
                <Clock className="size-4" />
                Full history
              </Link>
            </Button>
          }
        />
        {recentEvents.length === 0 ? (
          <NoResultsMessage
            title="No history yet"
            description="Events for this resolver will appear here."
            className="mx-0 my-0"
          />
        ) : (
          <ResolverEventsTable events={recentEvents} enableSidebar={false} />
        )}
      </div>
    </div>
  )
}
