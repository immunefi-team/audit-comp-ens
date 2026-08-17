import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'

export type ResolverAlias = {
  readonly fromName: string
  readonly toName: string
}

export type ResolverRole = {
  readonly account: string
  readonly resource: string
  readonly roleBitmap: string
  readonly blockNumber: number
  readonly transactionHash: string | null
  readonly timestamp: number | null
  readonly name: string | null
}

export type ResolverEvent = {
  readonly id: string
  readonly type: string
  readonly blockNumber: number
  readonly timestamp: number | null
  readonly transactionHash: string | null
  readonly data: string
}

export type ResolverNode = {
  readonly id: string
  readonly name: string
  readonly owner: { readonly id: string } | null
  readonly resolver: { readonly id: string; readonly address: string } | null
}

export type ResolverOverview = {
  readonly id: string
  readonly address: string
  readonly nodeCount: number
  readonly aliasCount: number
  readonly roleHolderCount: number
  readonly nodes: readonly ResolverNode[]
  readonly aliases: readonly ResolverAlias[]
  readonly roles: readonly ResolverRole[]
  readonly events: readonly ResolverEvent[]
}

class GetResolverOverviewError extends TaggedError('GetResolverOverviewError')<{
  cause: ClientError
}> {}

type GetResolverOverviewParameters = {
  address: Address
}

const getResolverOverview = ResultFn(async function* ({
  address,
}: GetResolverOverviewParameters) {
  const { resolver } = yield* fromPromise(
    graphqlIndexerClient.request<{
      resolver: ResolverOverview | null
    }>(
      gql`
        query getResolverOverview($id: String!) {
          resolver(id: $id) {
            id
            address
            nodeCount
            aliasCount
            roleHolderCount
            nodes {
              id
              name
              owner {
                id
              }
              resolver {
                id
                address
              }
            }
            aliases {
              fromName
              toName
            }
            roles {
              account
              resource
              roleBitmap
              blockNumber
              transactionHash
              timestamp
              name
            }
            events {
              id
              type
              blockNumber
              timestamp
              transactionHash
              data
            }
          }
        }
      `,
      { id: address.toLowerCase() },
    ),
    (e) =>
      new GetResolverOverviewError({
        cause: e as ClientError,
      }),
  )

  return ok(resolver)
})

const resolverOverviewQueryKey = createQueryKey<
  'resolver-overview',
  GetResolverOverviewParameters
>('resolver-overview')

export const getResolverOverviewQueryOptions = (
  params: GetResolverOverviewParameters,
) =>
  resultQueryOptions({
    queryKey: resolverOverviewQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getResolverOverview(params),
  })
