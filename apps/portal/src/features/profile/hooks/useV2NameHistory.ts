import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Hex } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'

class GetV2NameHistoryError extends TaggedError('GetV2NameHistoryError')<{
  cause: GetV2NameHistoryErrorType
}> {}

type GetV2NameHistoryErrorType = ClientError

type GetV2NameHistoryParameters = {
  name: string
  first?: number
  orderDirection?: 'asc' | 'desc'
  /** Restrict the history to these event types (e.g. `AddressChanged`). */
  eventTypes?: readonly string[]
}

export type V2NameHistoryEvent = {
  name: string
  type: string
  transactionHash: Hex
  timestamp: number
  blockNumber: number
}

type V2DomainWithEvents = {
  events: V2NameHistoryEvent[]
}

const getV2NameHistory = ResultFn(async function* ({
  name,
  first,
  orderDirection,
  eventTypes,
}: GetV2NameHistoryParameters) {
  // The indexer silently ignores `type_in` when the list arrives as a GraphQL
  // variable (nested `EventFilter` variable coercion bug), so the filter has
  // to be inlined into the document. `eventTypes` values are app constants,
  // never user input.
  const typeFilter = eventTypes?.length
    ? `, where: { type_in: [${eventTypes.map((t) => JSON.stringify(t)).join(', ')}] }`
    : ''

  const { domains } = yield* fromPromise(
    graphqlIndexerClient.request<{
      domains: V2DomainWithEvents[]
    }>(
      // `domains` MUST be bounded. The name filter matches at most one domain
      // (we read `domains[0]` below), but an unbounded connection is costed at
      // the server's default page size of 100, and the cost multiplies through
      // `events`: 100 x 1000 x fields = 600100, over the complexity limit.
      // With `first: 1` even `events(first: 1000)` is comfortably under.
      //
      // Ordering is applied server-side, in SQL, BEFORE `first` truncates —
      // which is what makes `{ first: n, orderDirection: 'asc' }` return the
      // OLDEST n rather than the newest n rearranged. Sorting the page in the
      // client cannot reproduce that.
      gql`
        query getV2NameHistory($name: String!, $first: Int, $orderDirection: OrderDirection) {
          domains(where: { name: $name }, first: 1) {
            events(first: $first, orderBy: timestamp, orderDirection: $orderDirection${typeFilter}) {
              name
              type
              transactionHash
              timestamp
              blockNumber
            }
          }
        }
      `,
      { name: name.toLowerCase(), first, orderDirection },
    ),
    (e) =>
      new GetV2NameHistoryError({
        cause: e as GetV2NameHistoryErrorType,
      }),
  )

  // Query returns at most one domain (filtered by name)
  const events = domains[0]?.events ?? []

  return ok(events)
})

const getV2NameHistoryQueryKey = createQueryKey<
  'get-v2-name-history',
  GetV2NameHistoryParameters
>('get-v2-name-history')

export const getV2NameHistoryQueryOptions = (
  params: GetV2NameHistoryParameters,
) =>
  resultQueryOptions({
    queryKey: getV2NameHistoryQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getV2NameHistory(params),
  })
