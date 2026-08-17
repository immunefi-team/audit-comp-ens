import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Hash } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'

class GetRegistryDeploymentError extends TaggedError(
  'GetRegistryDeploymentError',
)<{
  cause: ClientError
}> {}

type GetRegistryDeploymentParameters = {
  /** Namehash of the registry's name (e.g. namehash of "fox.eth"). */
  readonly namehash: string
  /** Block the registry was created at — disambiguates the creating event. */
  readonly createdBlock: number
}

export type RegistryDeployment = {
  readonly transactionHash: Hash
}

/**
 * Resolves a registry's deployment transaction.
 *
 * A registry is created when its parent registry sets it as the subregistry for
 * a name — emitting a `SubregistryUpdated` event (on the *parent* registry)
 * keyed by this registry's namehash, at the block recorded as the registry's
 * `createdBlock`. That event's transaction is the deployment. We scope by
 * namehash + createdBlock so that, if a name's subregistry is later reassigned,
 * we still resolve the event that created *this* registry.
 */
const getRegistryDeployment = ResultFn(async function* ({
  namehash,
  createdBlock,
}: GetRegistryDeploymentParameters) {
  const { events } = yield* fromPromise(
    graphqlIndexerClient.request<{ events: RegistryDeployment[] }>(
      gql`
        query getRegistryDeployment($namehash: String!, $createdBlock: Int!) {
          events(
            where: {
              type: "SubregistryUpdated"
              namehash: $namehash
              blockNumber_gte: $createdBlock
              blockNumber_lte: $createdBlock
            }
            first: 1
          ) {
            transactionHash
          }
        }
      `,
      { namehash, createdBlock },
    ),
    (e) => new GetRegistryDeploymentError({ cause: e as ClientError }),
  )

  return ok(events[0] ?? null)
})

const getRegistryDeploymentQueryKey = createQueryKey<
  'get-registry-deployment',
  GetRegistryDeploymentParameters
>('get-registry-deployment')

export const getRegistryDeploymentQueryOptions = (
  params: GetRegistryDeploymentParameters,
) =>
  resultQueryOptions({
    queryKey: getRegistryDeploymentQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getRegistryDeployment(params),
  })
