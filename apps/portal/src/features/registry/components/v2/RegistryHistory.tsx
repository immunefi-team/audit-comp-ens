import { useQuery } from '@tanstack/react-query'
import { type Address, zeroAddress } from 'viem'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { NameSubgraphHistory } from '@/components/table/NameSubgraphHistory/NameSubgraphHistory'
import type { SubgraphEvent } from '@/utils/history/groupEventsByTransactionId'
import { getNameRegistriesQueryOptions } from '../../hooks/useNameRegistryDiscovery'
import { getRegistryEventsQueryOptions } from '../../hooks/useRegistryEvents'

/**
 * History table for a registry contract, given its address. Reuses
 * `NameSubgraphHistory` by mapping indexer `RegistryEvent`s onto the
 * `SubgraphEvent` shape it consumes via the `v2Events` prop — the events
 * already carry timestamps, so only the transaction sender ("From") is
 * fetched downstream.
 */
export const RegistryHistoryByAddress = ({
  address,
  name,
  enableHeader,
}: {
  address: Address
  name: string
  enableHeader?: boolean
}) => {
  const {
    data: events,
    isLoading: isLoadingEvents,
    error: eventsError,
  } = useQuery(getRegistryEventsQueryOptions({ address }))

  if (isLoadingEvents) {
    return <LoadingSpinner title="Loading registry history..." />
  }
  if (eventsError) {
    return (
      <ErrorMessage
        compact
        description="Error fetching registry history. Please refresh the page."
      />
    )
  }

  if (!events || events.length === 0)
    return (
      <NoResultsMessage
        title="No history yet"
        description="Events for this registry will appear here."
        className="mx-0"
      />
    )

  const v2Events: SubgraphEvent[] = events.map((event) => ({
    transactionID: event.transactionHash,
    blockNumber: event.blockNumber,
    id: event.id,
    type: event.type,
    timestamp: BigInt(event.timestamp),
  }))

  return (
    <NameSubgraphHistory
      name={name}
      v2Events={v2Events}
      enableHeader={enableHeader}
    />
  )
}

/**
 * History table for a name's own registry contract. Discovers the address
 * via `getNameRegistriesQueryOptions` (which returns registries ordered
 * `[name, ...ancestors, root]`, so the name's own registry is at index 0)
 * and delegates to `RegistryHistoryByAddress`.
 */
export const RegistryHistory = ({ name }: { name: string }) => {
  const {
    data: registries,
    isLoading: isLoadingRegistries,
    error: registriesError,
  } = useQuery(getNameRegistriesQueryOptions({ name }))
  const address = registries?.at(0) ?? null
  const hasRegistry = !!address && address !== zeroAddress

  if (isLoadingRegistries) {
    return <LoadingSpinner title="Loading registry history..." />
  }

  if (registriesError) {
    return (
      <ErrorMessage
        compact
        description="Error fetching registry history. Please refresh the page."
      />
    )
  }

  if (!hasRegistry) return null

  return <RegistryHistoryByAddress address={address} name={name} />
}
