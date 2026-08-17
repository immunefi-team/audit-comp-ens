import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { type ClientError, gql } from 'graphql-request'
import { fromPromise, ok } from 'neverthrow'
import type { Address, Hex } from 'viem'
import { namehash, normalize } from 'viem/ens'
import { getBlockTimestamps } from '@/features/profile/hooks/useBlockTimestamps'
import { graphqlIndexerClient } from '@/lib/indexer'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { truncateToTransactions } from '../truncateToTransactions'
import { adaptV1Events } from '../v1/adaptV1Events'
import { fetchV1NameHistory } from '../v1/fetchV1NameHistory'

/**
 * Widened per-name history query for the timeline.
 *
 * Unlike `getV2NameHistoryQueryOptions` (which selects only type/tx/timestamp/block),
 * this selects the emitting `contractAddress`, the raw `data` blob, and every typed
 * `as*` decoder the indexer exposes — everything the summarize engine needs to build
 * human-readable action labels and decoded-param detail views.
 *
 * Events are read from BOTH protocols and merged: the v2 indexer has no `domains`
 * row at all for a name that never migrated, so a v1-only name would otherwise
 * render an empty timeline. v1 events are normalized to this same shape by
 * `v1/adaptV1Events.ts`.
 *
 * TODO(indexer): add `from` (tx sender) to `Event` so the "by {actor}" / "initiated by"
 * lines are first-class instead of RPC-backfilled (see useTransactionSenders).
 * TODO(indexer): add typed decoders for ContenthashChanged / NameChanged so those
 * actions don't rely on parsing the raw `data` JSON (see summarize/decodeRawData.ts).
 */

class GetNameHistoryTimelineError extends TaggedError(
  'GetNameHistoryTimelineError',
)<{
  cause: ClientError
}> {}

/**
 * On-chain integer params. The v2 indexer sends these as JSON numbers, but v1
 * values are adapted from subgraph strings and must not round-trip through
 * `Number` — a uint64 expiry or uint256 coin type exceeds
 * `Number.MAX_SAFE_INTEGER`. Nothing does arithmetic on them; they are
 * stringified for the decoded-param table, which handles either.
 */
type OnChainInt = number | bigint | null

export type TimelineDecoded = {
  readonly asAddressChanged?: {
    address?: string | null
    coinType?: OnChainInt
    resolver?: string | null
    namehash?: string | null
  } | null
  readonly asTextChanged?: {
    key?: string | null
    value?: string | null
    resolver?: string | null
    namehash?: string | null
  } | null
  readonly asTransfer?: {
    from?: string | null
    to?: string | null
    id?: string | null
    operator?: string | null
    value?: string | null
  } | null
  readonly asRegistryTransfer?: {
    node?: string | null
    owner?: string | null
  } | null
  readonly asLabelRegistered?: {
    name?: string | null
    owner?: string | null
    registry?: string | null
    tokenId?: string | null
    sender?: string | null
    canonicalId?: string | null
    expiry?: OnChainInt
  } | null
  readonly asNameRegistered?: {
    name?: string | null
    label?: string | null
    owner?: string | null
    cost?: string | null
    baseCost?: string | null
    premium?: string | null
    referrer?: string | null
    expires?: OnChainInt
  } | null
  readonly asNameRenewed?: {
    id?: string | null
    expires?: OnChainInt
  } | null
  readonly asResolverUpdated?: {
    resolver?: string | null
    sender?: string | null
    tokenId?: string | null
  } | null
  readonly asReverseClaimed?: {
    address?: string | null
    node?: string | null
  } | null
  readonly asNameWrapped?: {
    node?: string | null
    owner?: string | null
    fuses?: OnChainInt
    expiry?: OnChainInt
  } | null
  readonly asNameUnwrapped?: {
    node?: string | null
    owner?: string | null
  } | null
  readonly asFusesSet?: { node?: string | null; fuses?: OnChainInt } | null
  readonly asExpiryUpdated?: {
    node?: string | null
    tokenId?: string | null
    expiry?: OnChainInt
  } | null
}

export type TimelineIndexerEvent = TimelineDecoded & {
  readonly id: string
  readonly type: string
  readonly name?: string | null
  readonly namehash?: string | null
  readonly protocol?: string | null
  readonly transactionHash: Hex
  readonly blockNumber: number
  readonly timestamp: number
  readonly contractAddress?: Address | null
  readonly key?: string | null
  readonly value?: string | null
  /** Raw JSON blob of decoded params — fallback for event types without an `as*` decoder. */
  readonly data?: string | null
}

type GetNameHistoryTimelineParameters = {
  readonly name: string
  readonly first?: number
  readonly orderDirection?: 'asc' | 'desc'
}

type DomainWithEvents = { events: TimelineIndexerEvent[] }

export const V1_PROTOCOL = 'v1'

export const HISTORY_TIMELINE_PAGE_SIZE = 100

/**
 * Direct children come from `subdomains`, not a `name_ends_with` suffix match:
 * the suffix also matches every deeper descendant, so `a.b.leon.eth` would land
 * in `leon.eth`'s timeline.
 *
 * `first` is passed explicitly so the page size is ours: omitting it falls back
 * to the indexer's own default (10 at time of writing), which can change
 * server-side without a deploy here.
 *
 * These are not the *newest* children — `subdomains` accepts `orderBy` /
 * `orderDirection` but ignores them, always sorting by name — so a parent with
 * more children than this contributes its alphabetically-first ones. Sorting
 * client-side would mean fetching every child, the unbounded query this limit
 * exists to avoid.
 * TODO(indexer): honour `orderBy: createdAt` on `subdomains`.
 */
const HISTORY_TIMELINE_CHILD_LIMIT = 25

const HISTORY_TIMELINE_QUERY = gql`
  fragment TimelineEvent on Event {
    id
    type
    name
    namehash
    protocol
    transactionHash
    blockNumber
    timestamp
    contractAddress
    key
    value
    data
    asAddressChanged { address coinType resolver namehash }
    asTextChanged { key value resolver namehash }
    asTransfer { from to id operator value }
    asRegistryTransfer { node owner }
    asLabelRegistered { name owner registry tokenId sender canonicalId expiry }
    asNameRegistered { name label owner cost baseCost premium referrer expires }
    asNameRenewed { id expires }
    asResolverUpdated { resolver sender tokenId }
    asReverseClaimed { address node }
    asNameWrapped { node owner fuses expiry }
    asNameUnwrapped { node owner }
    asFusesSet { node fuses }
    asExpiryUpdated { node tokenId expiry }
  }

  query getNameHistoryTimeline(
    $name: String!
    $first: Int
    $orderDirection: OrderDirection
  ) {
    domains(where: { name: $name }, first: 1) {
      events(first: $first, orderBy: timestamp, orderDirection: $orderDirection) {
        ...TimelineEvent
      }
      subdomains(first: ${HISTORY_TIMELINE_CHILD_LIMIT}) {
        events(
          first: 1
          orderBy: timestamp
          orderDirection: asc
          where: { type_in: ["LabelRegistered"] }
        ) {
          ...TimelineEvent
        }
      }
    }
  }
`

const getNameHistoryTimeline = ResultFn(async function* ({
  name,
  first = HISTORY_TIMELINE_PAGE_SIZE,
  orderDirection = 'desc',
}: GetNameHistoryTimelineParameters) {
  const client = yield* safeGetClient()
  const normalizedName = (() => {
    try {
      return normalize(name)
    } catch {
      return name.toLowerCase()
    }
  })()
  const node = namehash(normalizedName)

  // Each source returns `[]` for a name the other owns, so an empty result is
  // normal and only a genuine failure rejects — same all-or-nothing behaviour
  // the page had before the timeline.
  const [v2Events, v1Raw] = yield* fromPromise(
    Promise.all([
      graphqlIndexerClient
        .request<{
          domains: (DomainWithEvents & { subdomains: DomainWithEvents[] })[]
        }>(HISTORY_TIMELINE_QUERY, {
          name: normalizedName,
          first,
          orderDirection,
        })
        .then(({ domains: [domain] }) => {
          if (!domain) return []
          // A child's registration can also be attributed to the parent.
          const seen = new Set(domain.events.map((event) => event.id))
          return [
            ...domain.events,
            ...domain.subdomains
              .flatMap(({ events }) => events)
              .filter((event) => !seen.has(event.id)),
          ]
        }),
      fetchV1NameHistory({
        subgraphUrl: client.chain.subgraphs.ens.url,
        namehash: node,
        first,
        orderDirection,
      }),
    ]),
    (e) => new GetNameHistoryTimelineError({ cause: e as ClientError }),
  )

  // v1 events carry no timestamp; the timeline sorts and dates on one.
  const blockTimestamps = yield* getBlockTimestamps({
    blocks: v1Raw.map((event) => BigInt(event.blockNumber)),
  })

  const v1Events = adaptV1Events({
    events: v1Raw,
    blockTimestamps,
    name: normalizedName,
    namehash: node,
    // Static chain constants, not lookups — the v1 subgraph records no
    // emitting address, so the contract badge is reconstructed from these.
    contracts: {
      registry: client.chain.contracts.ensRegistry.address,
      nameWrapper: client.chain.contracts.ensNameWrapper.address,
      baseRegistrar:
        client.chain.contracts.ensBaseRegistrarImplementation.address,
    },
  })

  // `first` bounds each source's query independently — one v2 collection plus
  // one v1 collection per registry / registrar / resolver-the-name-ever-used —
  // so the merge can hold several times it. Truncation happens on
  // transaction boundaries because `summarizeEvents` groups by transaction: a
  // half-included transaction would be summarized from a subset of its events.
  return ok(
    truncateToTransactions(
      [...v2Events, ...v1Events].sort((a, b) => b.timestamp - a.timestamp),
      first,
    ),
  )
})

const getNameHistoryTimelineQueryKey = createQueryKey<
  'get-name-history-timeline',
  GetNameHistoryTimelineParameters
>('get-name-history-timeline')

export const getNameHistoryTimelineQueryOptions = (
  params: GetNameHistoryTimelineParameters,
) =>
  resultQueryOptions({
    queryKey: getNameHistoryTimelineQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getNameHistoryTimeline(params),
  })
