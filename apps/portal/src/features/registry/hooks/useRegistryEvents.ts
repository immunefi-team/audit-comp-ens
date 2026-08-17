import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address, Hash } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'

class GetRegistryEventsError extends TaggedError('GetRegistryEventsError')<{
  cause: ClientError
}> {}

type GetRegistryEventsParameters = {
  address: Address
  orderDirection?: 'asc' | 'desc'
}

export type RegistryEvent = {
  id: string
  type: string
  name: string | null
  namehash: string | null
  protocol: string
  contractAddress: string
  transactionHash: Hash
  blockNumber: number
  timestamp: number
  data: string | null
}

const EVENTS_LIMIT = 50

const getRegistryEvents = ResultFn(async function* ({
  address,
  orderDirection = 'desc',
}: GetRegistryEventsParameters) {
  const { registry } = yield* fromPromise(
    graphqlIndexerClient.request<{
      registry: {
        eventConnection: {
          edges: { node: RegistryEvent }[]
        }
      } | null
    }>(
      gql`
        query getRegistryEvents(
          $address: String!
          $first: Int
          $orderDirection: OrderDirection
        ) {
          registry(address: $address) {
            eventConnection(
              first: $first
              orderBy: timestamp
              orderDirection: $orderDirection
            ) {
              edges {
                node {
                  id
                  type
                  name
                  namehash
                  protocol
                  contractAddress
                  transactionHash
                  blockNumber
                  timestamp
                  data
                }
              }
            }
          }
        }
      `,
      { address: address.toLowerCase(), first: EVENTS_LIMIT, orderDirection },
    ),
    (e) => new GetRegistryEventsError({ cause: e as ClientError }),
  )

  const events: RegistryEvent[] = registry
    ? registry.eventConnection.edges.map((e) => e.node)
    : []

  return ok(events)
})

const getRegistryEventsQueryKey = createQueryKey<
  'get-registry-events',
  GetRegistryEventsParameters
>('get-registry-events')

export const getRegistryEventsQueryOptions = (
  params: GetRegistryEventsParameters,
) =>
  resultQueryOptions({
    queryKey: getRegistryEventsQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getRegistryEvents(params),
  })
