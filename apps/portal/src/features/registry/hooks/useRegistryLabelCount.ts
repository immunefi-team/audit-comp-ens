import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address, Hash } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'

class GetRegistryLabelCountError extends TaggedError(
  'GetRegistryLabelCountError',
)<{
  cause: ClientError
}> {}

type GetRegistryLabelCountParameters = {
  address: Address
}

export type RegistryLabel = {
  name: string | null
  labelName: string | null
  labelhash: string
}

export type RegistrySummary = {
  labelCount: number
  createdAt: number
  creationTransactionHash: Hash | null
  labels: RegistryLabel[]
}

const LABELS_SAMPLE_SIZE = 20

const getRegistryLabelCount = ResultFn(async function* ({
  address,
}: GetRegistryLabelCountParameters) {
  const { registry } = yield* fromPromise(
    graphqlIndexerClient.request<{
      registry: {
        labelCount: number
        createdAt: number
        creationEvent: { edges: { node: { transactionHash: Hash } }[] }
        labels: RegistryLabel[]
      } | null
    }>(
      gql`
        query getRegistryLabelCount($address: String!, $first: Int!) {
          registry(address: $address) {
            labelCount
            createdAt
            creationEvent: eventConnection(
              first: 1
              orderBy: timestamp
              orderDirection: asc
            ) {
              edges {
                node {
                  transactionHash
                }
              }
            }
            labels(first: $first, orderBy: name, orderDirection: asc) {
              name
              labelName
              labelhash
            }
          }
        }
      `,
      { address: address.toLowerCase(), first: LABELS_SAMPLE_SIZE },
    ),
    (e) => new GetRegistryLabelCountError({ cause: e as ClientError }),
  )

  // null = indexer has no record for this registry address (not yet indexed,
  // or contract doesn't exist). Distinct from a registry with 0 labels.
  if (!registry) return ok(null)

  const summary: RegistrySummary = {
    labelCount: registry.labelCount,
    createdAt: registry.createdAt,
    creationTransactionHash:
      registry.creationEvent?.edges[0]?.node.transactionHash ?? null,
    labels: registry.labels,
  }

  return ok(summary)
})

const getRegistryLabelCountQueryKey = createQueryKey<
  'get-registry-label-count',
  GetRegistryLabelCountParameters
>('get-registry-label-count')

export const getRegistryLabelCountQueryOptions = (
  params: GetRegistryLabelCountParameters,
) =>
  resultQueryOptions({
    queryKey: getRegistryLabelCountQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getRegistryLabelCount(params),
  })
