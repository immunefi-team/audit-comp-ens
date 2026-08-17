import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { type Address, isAddress, isAddressEqual } from 'viem'
import { useConnection, useDisconnect, useEnsName } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { HistorySectionHeader } from '@/components/HistorySectionHeader'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { NameSubgraphHistory } from '@/components/table/NameSubgraphHistory/NameSubgraphHistory'
import { Button } from '@/components/ui/button'
import { getV2HistoryForAddressQueryOptions } from '@/features/address/components/hooks/useV2HistoryForAddress'
import { NameList } from '@/features/dashboard/components/NameList'
import { NameProfileCard } from '@/features/profile/components/NameProfileCard'
import { extractErrorMessage } from '@/utils/errors/extractErrorMessage'
import { transformV2EventsToSubgraphFormat } from '@/utils/history/transformV2Events'
import { queryClient } from '@/utils/queryClient'

export const Route = createFileRoute('/addr/$addr/')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  loader: ({ params }) =>
    queryClient.prefetchQuery(
      getV2HistoryForAddressQueryOptions({
        address: params.addr as Address,
      }),
    ),
})

interface PrimaryNameProps {
  address: Address
}

const PrimaryName = ({ address }: PrimaryNameProps) => {
  const {
    data: name,
    isLoading,
    error,
  } = useEnsName({
    address,
  })

  if (error) {
    return (
      <ErrorMessage
        title="Error loading data"
        description={extractErrorMessage(error)}
      />
    )
  }

  if (isLoading) return <LoadingMessage />

  if (name) return <NameProfileCard name={name} />
  return null
}

interface AddressHistoryProps {
  address: Address
}

const RECENT_EVENT_LIMIT = 5

const AddressRecentHistory = ({ address }: AddressHistoryProps) => {
  const { data: v2Events } = useQuery(
    getV2HistoryForAddressQueryOptions({ address }),
  )

  const recentEvents = v2Events
    ? transformV2EventsToSubgraphFormat(
        v2Events
          .toSorted((a, b) => b.timestamp - a.timestamp)
          .slice(0, RECENT_EVENT_LIMIT),
      )
    : undefined

  return (
    <div className="flex flex-col gap-4 w-full">
      <HistorySectionHeader
        action={
          <Button variant="ghost" size="sm" className="text-neutral-7" asChild>
            <Link to="/addr/$addr/history" params={{ addr: address }}>
              <Clock className="size-4" />
              Full history
            </Link>
          </Button>
        }
      />
      <NameSubgraphHistory
        name={address}
        category="domain"
        v2Events={recentEvents}
        enableHeader={false}
      />
    </div>
  )
}

function RouteComponent() {
  const { disconnect } = useDisconnect()
  const { address: connectedAddress } = useConnection()
  const { addr } = Route.useParams() as { addr: Address }

  const isViewingConnectedWallet =
    !!connectedAddress &&
    isAddress(addr) &&
    isAddressEqual(connectedAddress, addr)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 lg:flex-row justify-between items-baseline">
        <h1 className="text-h2 md:text-h1 break-all">{addr}</h1>
        {isViewingConnectedWallet && (
          <Button variant="default" onClick={() => disconnect()}>
            Disconnect
          </Button>
        )}
      </div>
      <PrimaryName address={addr} />
      <h2 className="text-h2">Names</h2>
      <NameList address={addr} limit={3} />
      <AddressRecentHistory address={addr} />
    </div>
  )
}
