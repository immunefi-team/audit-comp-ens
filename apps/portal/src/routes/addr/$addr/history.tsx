import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { Address } from 'viem'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { AddressHistoryDataTable } from '@/features/address/components/AddressHistoryDataTable'
import { getV2HistoryForAddressQueryOptions } from '@/features/address/components/hooks/useV2HistoryForAddress'
import { getV1HistoryForAddressQueryOptions } from '@/features/address/hooks/useV1HistoryForAddress'
import { queryClient } from '@/utils/queryClient'

export const Route = createFileRoute('/addr/$addr/history')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  loader: ({ params }) =>
    Promise.all([
      queryClient.prefetchQuery(
        getV1HistoryForAddressQueryOptions({
          address: params.addr as Address,
        }),
      ),
      queryClient.prefetchQuery(
        getV2HistoryForAddressQueryOptions({
          address: params.addr as Address,
        }),
      ),
    ]),
})

function RouteComponent() {
  const { addr } = Route.useParams() as { addr: Address }

  // Fetch V1 history (L1 subgraph)
  const {
    data: v1Data,
    isLoading: isLoadingV1,
    error: v1Error,
  } = useQuery(getV1HistoryForAddressQueryOptions({ address: addr }))

  // Fetch V2 history (L2 indexer)
  const {
    data: v2Data,
    isLoading: isLoadingV2,
    error: v2Error,
  } = useQuery(getV2HistoryForAddressQueryOptions({ address: addr }))

  if (isLoadingV1) {
    return <LoadingMessage />
  }

  if (isLoadingV2) {
    return <LoadingMessage />
  }

  if (v1Error) {
    return (
      <ErrorMessage
        title="Error loading V1 history"
        description={v1Error.cause?.message}
      />
    )
  }

  if (v2Error) {
    return (
      <ErrorMessage
        title="Error loading V2 history"
        description={v2Error.cause?.message}
      />
    )
  }

  return (
    <AddressHistoryDataTable
      history={{
        v1Events: v1Data,
        v2Events: v2Data,
      }}
    />
  )
}
