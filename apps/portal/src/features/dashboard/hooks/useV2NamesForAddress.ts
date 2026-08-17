import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'
import type { V2Name } from '@/utils/names/mergeNamesData'

class GetV2NamesForAddressError extends TaggedError(
  'GetV2NamesForAddressError',
)<{
  cause: GetV2NamesForAddressErrorType
}> {}

type GetV2NamesForAddressErrorType = ClientError

type GetV2NamesForAddressParameters = {
  address: Address
}

const getV2NamesForAddress = ResultFn(async function* ({
  address,
}: GetV2NamesForAddressParameters) {
  const { domains } = yield* fromPromise(
    graphqlIndexerClient.request<{
      domains: V2Name[]
    }>(
      gql`query getNamesForAddress($addr: String!) {
      domains(where: {owner: $addr}) {
        name
        expiryDate
        subdomains {
          name
        }
      }
    }`,
      { addr: address.toLowerCase() },
    ),
    (e) =>
      new GetV2NamesForAddressError({
        cause: e as GetV2NamesForAddressErrorType,
      }),
  )

  return ok(domains)
})

const getV2NamesForAddressQueryKey = createQueryKey<
  'get-v2-names-for-address',
  GetV2NamesForAddressParameters
>('get-v2-names-for-address')

export const getV2NamesForAddressQueryOptions = (
  params: GetV2NamesForAddressParameters,
) =>
  resultQueryOptions({
    queryKey: getV2NamesForAddressQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getV2NamesForAddress(params),
  })
