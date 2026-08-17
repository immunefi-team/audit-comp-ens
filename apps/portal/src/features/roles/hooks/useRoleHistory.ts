import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { labelToCanonicalId } from '@ensdomains/ensjs/utils/v2'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import { graphqlIndexerClient } from '@/lib/indexer'
import {
  filterEventsByResource,
  type IndexerEACEvent,
} from '@/lib/roles/filterEventsByResource'
import { toResourceHex } from '@/lib/roles/toResourceHex'

export type { RoleHistoryEntry } from '@/lib/roles/filterEventsByResource'

class GetRoleHistoryError extends TaggedError('GetRoleHistoryError')<{
  cause: ClientError
}> {}

type GetRoleHistoryParameters = {
  readonly label?: string
}

const PAGE_SIZE = 1000
// Hard upper bound on how many events we will ever scan in a single call so
// a runaway indexer can't make this loop forever.
const MAX_PAGES = 50

const getRoleHistory = ResultFn(async function* ({
  label,
}: GetRoleHistoryParameters) {
  // NOTE: We intentionally do not filter by `domain` in the GraphQL query.
  // The indexer does not currently populate the `domain` relation on
  // `EACRolesChanged` events for many names (e.g. 2LDs like `fresh.eth`),
  // so filtering server-side by `domain` would drop valid events. Instead we
  // fetch by event type and filter client-side by the resource hex.
  //
  // Pagination is done with a `blockNumber_lt` cursor (descending) because
  // the indexer's relay-style `eventConnection.after` and `events.skip`
  // pagination are currently both broken — they return the same first page
  // regardless of the cursor.
  const allEvents: IndexerEACEvent[] = []
  let blockNumberLt = Number.MAX_SAFE_INTEGER

  for (let page = 0; page < MAX_PAGES; page++) {
    const { events } = yield* fromPromise(
      graphqlIndexerClient.request<{
        events: IndexerEACEvent[]
      }>(
        gql`
          query getRoleHistory($blockNumberLt: Int!, $first: Int!) {
            events(
              where: {
                type: "EACRolesChanged"
                blockNumber_lt: $blockNumberLt
              }
              first: $first
              orderBy: blockNumber
              orderDirection: desc
            ) {
              type
              data
              transactionHash
              timestamp
              blockNumber
            }
          }
        `,
        { blockNumberLt, first: PAGE_SIZE },
      ),
      (e) => new GetRoleHistoryError({ cause: e as ClientError }),
    )

    if (events.length === 0) break

    allEvents.push(...events)

    if (events.length < PAGE_SIZE) break

    // Step the cursor to just before the oldest block we just received.
    blockNumberLt = events[events.length - 1].blockNumber
  }

  const resource = label ? toResourceHex(labelToCanonicalId(label)) : undefined

  return ok(filterEventsByResource(allEvents, resource))
})

const getRoleHistoryQueryKey = createQueryKey<
  'get-role-history',
  GetRoleHistoryParameters
>('get-role-history')

export const getRoleHistoryQueryOptions = (params: GetRoleHistoryParameters) =>
  resultQueryOptions({
    queryKey: getRoleHistoryQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getRoleHistory(params),
  })
