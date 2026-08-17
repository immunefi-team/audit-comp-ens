import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address, Hex } from 'viem'
import { graphqlIndexerClient } from '@/lib/indexer'

class GetV2HistoryForAddressError extends TaggedError(
  'GetV2HistoryForAddressError',
)<{
  cause: GetV2HistoryForAddressErrorType
}> {}

type GetV2HistoryForAddressErrorType = ClientError

type GetV2HistoryForAddressParameters = {
  address: Address
}

export type V2Event = {
  name: string
  type: string
  transactionHash: Hex
  timestamp: number
  blockNumber: number
}

type V2DomainWithEvents = {
  events: V2Event[]
}

const getV2HistoryForAddress = ResultFn(async function* ({
  address,
}: GetV2HistoryForAddressParameters) {
  const { domains } = yield* await fromPromise(
    graphqlIndexerClient.request<{
      domains: V2DomainWithEvents[]
    }>(
      gql`query getHistoryForAddress($addr: String!) {
      domains(where: {owner: $addr}) {
        events {
          name
          type
          transactionHash
          timestamp
          blockNumber
        }
      }
    }`,
      { addr: address.toLowerCase() },
    ),
    (e) =>
      new GetV2HistoryForAddressError({
        cause: e as GetV2HistoryForAddressErrorType,
      }),
  )

  // Flatten events from all domains
  const events = domains.flatMap((domain) => domain.events)

  return ok(events)
})

const getV2HistoryForAddressQueryKey = createQueryKey<
  'get-v2-history-for-address',
  GetV2HistoryForAddressParameters
>('get-v2-history-for-address')

export const getV2HistoryForAddressQueryOptions = (
  params: GetV2HistoryForAddressParameters,
) =>
  resultQueryOptions({
    queryKey: getV2HistoryForAddressQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getV2HistoryForAddress(params),
  })
