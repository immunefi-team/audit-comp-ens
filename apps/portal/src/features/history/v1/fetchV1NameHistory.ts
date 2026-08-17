import { GraphQLClient, gql } from 'graphql-request'
import type { Hex } from 'viem'
import type { V1SubgraphEvent } from './adaptV1Events'

type V1SubgraphResult = {
  domain: {
    events: V1SubgraphEvent[]
    registration?: { cost?: string | null; events: V1SubgraphEvent[] } | null
  } | null
  resolvers: { events: V1SubgraphEvent[] }[]
}

/**
 * Bound on how many resolvers a single name's history is read from. The
 * subgraph writes one `Resolver` row per (resolver address, name) pair, so this
 * is "how many different resolvers has this name ever used" — a handful at
 * most, well under the cap.
 */
const RESOLVERS_PER_NAME = 100

/**
 * Fetch a name's v1 history as one flat event list — the registry / registrar /
 * resolver split is a quirk of the subgraph schema and carries no meaning once
 * the events are grouped by transaction. Returns `[]` (not an error) when the
 * subgraph has no record of the name, the common case for a v2-native name.
 *
 * This deliberately does not go through ensjs's `getNameHistory`: that action
 * flattens `{ id }` references with `id.split('-')[0]`, which returns the chain
 * id for ENSNode's `"{chainId}-{address}-{node}"` resolver ids and so loses the
 * resolver address entirely. We keep the raw refs and flatten them in
 * `adaptV1Events`.
 *
 * `$first` is passed explicitly because the three sibling `events` selections
 * are each costed at their worst case when the variable is unsupplied, and the
 * query is then rejected for exceeding the complexity limit. `orderBy:
 * blockNumber` is what makes it mean "the newest N" — the connection otherwise
 * orders by `id`, and ids are `"{chainId}-{blockNumber}-{logIndex}"` strings,
 * so they sort lexicographically and put block 10000000 before block 9529458.
 *
 * Resolver events are read from every resolver the name has ever pointed at
 * (`resolvers(where: { domain })`), not just `domain.resolver`: that field is
 * only the *current* one, so records set on a resolver the name has since
 * moved off would silently drop out of what reads as a complete history. Each
 * event names its own resolver via `resolverId`, so the flat list stays
 * unambiguous.
 *
 * `cost` lives on the `Registration` entity rather than on the `NameRegistered`
 * event (the subgraph writes it from a second handler), so it is folded onto
 * that event here — the adapter only ever sees events.
 */
export const fetchV1NameHistory = async ({
  subgraphUrl,
  namehash,
  first,
  orderDirection,
}: {
  readonly subgraphUrl: string
  readonly namehash: Hex
  readonly first: number
  readonly orderDirection: 'asc' | 'desc'
}): Promise<V1SubgraphEvent[]> => {
  const { domain, resolvers } = await new GraphQLClient(
    subgraphUrl,
  ).request<V1SubgraphResult>(
    gql`
      query getV1NameHistoryTimeline(
        $id: String!
        $first: Int
        $resolvers: Int
        $orderDirection: OrderDirection
      ) {
        domain(id: $id) {
          events(first: $first, orderBy: blockNumber, orderDirection: $orderDirection) {
            id
            blockNumber
            transactionID
            type: __typename
            ... on Transfer { owner { id } }
            ... on NewOwner { owner { id } parentDomain { name } }
            ... on NewResolver { resolverId }
            ... on NewTTL { ttl }
            ... on WrappedTransfer { owner { id } }
            ... on NameWrapped { name fuses expiryDate owner { id } }
            ... on NameUnwrapped { owner { id } }
            ... on FusesSet { fuses }
            ... on ExpiryExtended { expiryDate }
          }
          registration {
            cost
            events(first: $first, orderBy: blockNumber, orderDirection: $orderDirection) {
              id
              blockNumber
              transactionID
              type: __typename
              ... on NameRegistered { registrant { id } expiryDate }
              ... on NameRenewed { expiryDate }
              ... on NameTransferred { newOwner { id } }
            }
          }
        }
        resolvers(where: { domain: $id }, first: $resolvers) {
          events(first: $first, orderBy: blockNumber, orderDirection: $orderDirection) {
            id
            blockNumber
            transactionID
            type: __typename
            resolverId
            ... on AddrChanged { addr { id } }
            ... on MulticoinAddrChanged { coinType multiaddr: addr }
            ... on NameChanged { name }
            ... on AbiChanged { contentType }
            ... on PubkeyChanged { x y }
            ... on TextChanged { key value }
            ... on ContenthashChanged { hash }
            ... on InterfaceChanged { interfaceID implementer }
            ... on AuthorisationChanged { owner target isAuthorized }
            ... on VersionChanged { version }
          }
        }
      }
    `,
    { id: namehash, first, resolvers: RESOLVERS_PER_NAME, orderDirection },
  )

  const cost = domain?.registration?.cost

  return [
    ...(domain?.events ?? []),
    ...(domain?.registration?.events ?? []).map((event) =>
      event.type === 'NameRegistered' ? { ...event, cost } : event,
    ),
    ...(resolvers ?? []).flatMap(({ events }) => events),
  ]
}
