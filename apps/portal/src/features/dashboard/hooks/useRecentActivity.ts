import { TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise } from 'neverthrow'
import type { Hash } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'

export type RecentActivityEvent = {
  readonly name: string | null
  readonly type: string
  readonly transactionHash: Hash
  readonly timestamp: number
  readonly blockNumber: number
  readonly contractAddress: string
  readonly namehash: string | null
  readonly domain: { readonly name: string | null } | null
  readonly data: string
}

class GetRecentActivityError extends TaggedError('GetRecentActivityError')<{
  cause: ClientError
}> {}

const getRecentActivity = () =>
  fromPromise(
    graphqlIndexerClient.request<{ events: RecentActivityEvent[] }>(
      gql`
        query getRecentActivity {
          events(first: 15) {
            name
            type
            transactionHash
            timestamp
            blockNumber
            contractAddress
            namehash
            domain {
              name
            }
            data
          }
        }
      `,
    ),
    (e) => new GetRecentActivityError({ cause: e as ClientError }),
  ).map((data) =>
    [...data.events]
      .filter((e) => e.type !== 'CommitmentMade')
      .sort((a, b) => b.timestamp - a.timestamp),
  )

const getRecentActivityQueryKey = createQueryKey<
  'get-recent-activity',
  Record<never, never>
>('get-recent-activity')

export const getRecentActivityQueryOptions = () =>
  resultQueryOptions({
    queryKey: getRecentActivityQueryKey({}),
    queryFn: () => getRecentActivity(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
