import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { coinNameToTypeMap } from '@ensdomains/address-encoder'
import type { GetRecordsErrorType } from '@ensdomains/ensjs/public'
import type { GetSubgraphRecordsErrorType } from '@ensdomains/ensjs/subgraph'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import { graphqlIndexerClient } from '@/lib/indexer'
import { mergeCoinTypes, mergeTextKeys } from '@/utils/records/mergeRecordKeys'
import type { ProtocolVersion } from '@/utils/types'
import { getRecords } from './useRecords'
import { getSubgraphRecords } from './useSubgraphRecords'

class GetProfileError extends TaggedError('RecordsError')<{
  cause: GetRecordsErrorType | GetSubgraphRecordsErrorType | ClientError
}> {}

type GetProfileParameters = {
  name: string
  protocolVersion?: ProtocolVersion
}

const getProfile = ResultFn(async function* ({
  name,
  protocolVersion,
}: GetProfileParameters) {
  const isV1 = protocolVersion === 'ENSv1'
  const isV2 = protocolVersion === 'ENSv2'

  const subgraphV1Records = !isV2 ? yield* getSubgraphRecords(name) : null

  const subgraphV2Result = !isV1
    ? yield* fromPromise(
        graphqlIndexerClient.request<
          {
            domains: [
              {
                resolver: {
                  texts: string[] | null
                  addresses: { coinType: number; address: string }[] | null
                } | null
              },
            ]
          },
          { name: string }
        >(
          gql`query getRecords($name: String!) {
            domains(where: {name: $name}) {
              resolver {
                texts
                addresses {
                  coinType
                  address
                }
              }
            }
          }`,
          { name },
        ),
        (e) => new GetProfileError({ cause: e as ClientError }),
      )
    : null

  const subgraphV2Records = subgraphV2Result?.domains[0]?.resolver ?? null

  // Coin types the V2 resolver actually has, per the indexer. Without these,
  // migrated (ENSv2) names only surface the hardcoded default coins below,
  // so any other address record is silently dropped from the records tab.
  const subgraphV2Coins = subgraphV2Records?.addresses?.map(
    (address) => address.coinType,
  )

  const coins = mergeCoinTypes(
    [...(subgraphV1Records?.coins ?? []), ...(subgraphV2Coins ?? [])],
    [
      // default requested coins
      // EVM
      coinNameToTypeMap.eth,
      coinNameToTypeMap.arb1,
      coinNameToTypeMap.op,
      coinNameToTypeMap.base,

      // Non-EVM
      coinNameToTypeMap.btc,
      coinNameToTypeMap.doge,
      coinNameToTypeMap.sol,
      coinNameToTypeMap.strk,
    ],
  )

  const texts = mergeTextKeys(
    subgraphV1Records?.texts,
    subgraphV2Records?.texts ?? undefined,
    [
      // default requested texts
      'name',
      'description',
      'com.twitter',
      'org.telegram',
      'header',
      'avatar',
    ],
  )

  const records = yield* getRecords({
    name,
    ...(subgraphV1Records ?? {}),
    coins,
    texts,
    contentHash: true,
    abi: true,
    ignoreInvalidCoinTypes: true,
  })

  return ok({
    records,
    subgraphRecords: { ...(subgraphV1Records ?? {}) },
  })
})

export const profileQueryKey = createQueryKey<
  'profile',
  {
    name: string
    protocolVersion?: ProtocolVersion
  }
>('profile')

export const getProfileQueryOptions = ({
  name,
  protocolVersion,
}: GetProfileParameters) =>
  resultQueryOptions({
    queryKey: profileQueryKey({ name, protocolVersion }),
    queryFn: ({ queryKey: [, { name, protocolVersion }] }) =>
      getProfile({ name, protocolVersion }),
  })
