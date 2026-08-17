import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { createSubgraphClient } from '@ensdomains/ensjs/subgraph'
import type { ClientError } from 'graphql-request'
import { gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address } from 'viem'
import { safeGetClient } from '@/lib/wagmi/helpers'
import type { V1EventBase } from '@/utils/history/transformAddressHistory'

class GetV1HistoryForAddressError extends TaggedError(
  'GetV1HistoryForAddressError',
)<{
  cause: GetV1HistoryForAddressErrorType
}> {}

type GetV1HistoryForAddressErrorType = ClientError

type GetV1HistoryForAddressParameters = {
  address: Address
}

type V1HistoryResponse = {
  domains: Array<{
    events: V1EventBase[]
    registration?: {
      events: V1EventBase[]
    }
    resolver?: {
      events: V1EventBase[]
    }
  }>
}

/**
 * Fetches V1 history for an address from the ENS subgraph
 * Gets all domain, registration, and resolver events for domains owned by the address
 */
const getV1HistoryForAddress = ResultFn(async function* ({
  address,
}: GetV1HistoryForAddressParameters) {
  const client = yield* safeGetClient()
  const subgraphClient = createSubgraphClient(client)

  const query = gql`
    query getV1HistoryForAddress($address: String!, $first: Int, $orderDirection: OrderDirection) {
      domains(
        where: {
          or: [
            { owner: $address }
            { registrant: $address }
          ]
        }
        first: 100
      ) {
        events(first: $first, orderDirection: $orderDirection) {
          id
          blockNumber
          transactionID
          type: __typename
          ... on Transfer {
            owner {
              id
            }
          }
          ... on NewOwner {
            owner {
              id
            }
          }
          ... on NewResolver {
            resolver {
              id
            }
          }
          ... on NewTTL {
            ttl
          }
          ... on WrappedTransfer {
            owner {
              id
            }
          }
          ... on NameWrapped {
            fuses
            expiryDate
            owner {
              id
            }
          }
          ... on NameUnwrapped {
            owner {
              id
            }
          }
          ... on FusesSet {
            fuses
          }
          ... on ExpiryExtended {
            expiryDate
          }
        }
        registration {
          events(first: $first, orderDirection: $orderDirection) {
            id
            blockNumber
            transactionID
            type: __typename
            ... on NameRegistered {
              registrant {
                id
              }
              expiryDate
            }
            ... on NameRenewed {
              expiryDate
            }
            ... on NameTransferred {
              newOwner {
                id
              }
            }
          }
        }
        resolver {
          events(first: $first, orderDirection: $orderDirection) {
            id
            blockNumber
            transactionID
            type: __typename
            ... on AddrChanged {
              addr {
                id
              }
            }
            ... on MulticoinAddrChanged {
              coinType
              multiaddr: addr
            }
            ... on NameChanged {
              name
            }
            ... on AbiChanged {
              contentType
            }
            ... on PubkeyChanged {
              x
              y
            }
            ... on TextChanged {
              key
              value
            }
            ... on ContenthashChanged {
              hash
            }
            ... on InterfaceChanged {
              interfaceID
              implementer
            }
            ... on AuthorisationChanged {
              owner
              target
              isAuthorized
            }
            ... on VersionChanged {
              version
            }
          }
        }
      }
    }
  `

  const queryVars = {
    address: address.toLowerCase(),
    first: 1000,
    orderDirection: 'desc' as const,
  }

  const result = yield* fromPromise(
    subgraphClient.request<V1HistoryResponse, typeof queryVars>(
      query,
      queryVars,
    ),
    (e) =>
      new GetV1HistoryForAddressError({
        cause: e as GetV1HistoryForAddressErrorType,
      }),
  )

  // Flatten all events from all domains
  const domainEvents = result.domains.flatMap((domain) => domain.events || [])
  const registrationEvents = result.domains.flatMap(
    (domain) => domain.registration?.events || [],
  )
  const resolverEvents = result.domains.flatMap(
    (domain) => domain.resolver?.events || [],
  )

  return ok({
    domainEvents,
    registrationEvents,
    resolverEvents,
  })
})

const getV1HistoryForAddressQueryKey = createQueryKey<
  'get-v1-history-for-address',
  GetV1HistoryForAddressParameters
>('get-v1-history-for-address')

export const getV1HistoryForAddressQueryOptions = (
  params: GetV1HistoryForAddressParameters,
) =>
  resultQueryOptions({
    queryKey: getV1HistoryForAddressQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getV1HistoryForAddress(params),
  })
