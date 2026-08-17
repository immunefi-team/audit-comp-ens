import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'

class GetRegistryLabelsError extends TaggedError('GetRegistryLabelsError')<{
  cause: ClientError
}> {}

type GetRegistryLabelsParameters = {
  address: Address
}

export type RegistryLabelRow = {
  /** Full ENS name (e.g. "lmao.chakri.eth"); null if the label isn't reachable. */
  name: string | null
  /** The label segment (e.g. "lmao"); null when unnormalized. */
  labelName: string | null
  labelhash: string
  /** Unix seconds; null/0 means the label does not expire. */
  expiryDate: number | null
  /** Distinct accounts holding any label-scoped role on this label. */
  roleHoldersCount: number
}

const LABELS_LIMIT = 100

const getRegistryLabels = ResultFn(async function* ({
  address,
}: GetRegistryLabelsParameters) {
  const { registry } = yield* fromPromise(
    graphqlIndexerClient.request<{
      registry: {
        labels: RegistryLabelRow[]
      } | null
    }>(
      gql`
        query getRegistryLabels($address: String!) {
          registry(address: $address) {
            labels(first: ${LABELS_LIMIT}, orderBy: name, orderDirection: asc) {
              name
              labelName
              labelhash
              expiryDate
              roleHoldersCount: roleHolderCount
            }
          }
        }
      `,
      { address: address.toLowerCase() },
    ),
    (e) => new GetRegistryLabelsError({ cause: e as ClientError }),
  )

  if (!registry) return ok([])

  return ok(registry.labels)
})

const getRegistryLabelsQueryKey = createQueryKey<
  'get-registry-labels',
  GetRegistryLabelsParameters
>('get-registry-labels')

export const getRegistryLabelsQueryOptions = (
  params: GetRegistryLabelsParameters,
) =>
  resultQueryOptions({
    queryKey: getRegistryLabelsQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getRegistryLabels(params),
  })
