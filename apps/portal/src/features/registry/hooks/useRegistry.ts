import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'

class GetRegistryInfoError extends TaggedError('GetRegistryInfoError')<{
  cause: ClientError
}> {}

type GetRegistryInfoParameters = {
  address: Address
}

export type RegistryInfo = {
  address: Address
  /** This registry's own ENS name (e.g. "eth"); empty for the root. */
  name: string
  namehash: string
  /** Address of the parent registry (zero address for the root). */
  parentRegistry: Address
  createdBlock: number
  createdAt: number
  labelCount: number
  roleCount: number
  eventCount: number
  referencedBy: { name: string | null }[]
}

const getRegistryInfo = ResultFn(async function* ({
  address,
}: GetRegistryInfoParameters) {
  const { registry } = yield* fromPromise(
    graphqlIndexerClient.request<{ registry: RegistryInfo | null }>(
      gql`
        query getRegistryInfo($address: String!) {
          registry(address: $address) {
            address
            name
            namehash
            parentRegistry
            createdBlock
            createdAt
            labelCount
            roleCount
            eventCount
            referencedBy {
              name
            }
          }
        }
      `,
      { address: address.toLowerCase() },
    ),
    (e) => new GetRegistryInfoError({ cause: e as ClientError }),
  )

  // null = indexer has no record for this address (not a registry, or not yet
  // indexed). Distinct from a registry with zero labels/roles.
  return ok(registry)
})

const getRegistryInfoQueryKey = createQueryKey<
  'get-registry-info',
  GetRegistryInfoParameters
>('get-registry-info')

export const getRegistryInfoQueryOptions = (
  params: GetRegistryInfoParameters,
) =>
  resultQueryOptions({
    queryKey: getRegistryInfoQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getRegistryInfo(params),
  })
