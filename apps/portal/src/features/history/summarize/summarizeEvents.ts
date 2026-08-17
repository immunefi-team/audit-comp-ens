import type { TimelineIndexerEvent } from '../hooks/useNameHistoryTimeline'
import { DESCRIPTORS, humanizeType } from './descriptors'
import type { Action, ActionSlot } from './summarize.types'

/** Event types that never surface as their own action (nor as filter options). */
export const IGNORED_TYPES = new Set(['CommitmentMade'])

/**
 * Significance ranking used to pick the "primary" event that drives an action's
 * label when several events share a transaction (e.g. Register subname bundles
 * LabelRegistered + Transfer + RolesChanged → the register is primary).
 */
const TYPE_RANK: Record<string, number> = {
  NameRegistered: 100,
  LabelRegistered: 95,
  NameRenewed: 90,
  SubregistryUpdated: 80,
  RegistryTransfer: 78,
  Transfer: 70,
  ResolverUpdated: 60,
  EACRolesChanged: 55,
  NameWrapped: 50,
  NameUnwrapped: 50,
  ReverseClaimed: 46,
  NameChanged: 44,
  AddressChanged: 40,
  AddrChanged: 40,
  TextChanged: 30,
  ContenthashChanged: 30,
  FusesSet: 20,
  ExpiryUpdated: 20,
  // ENS v1 types with no v2 counterpart (see `v1/adaptV1Events.ts`).
  NameTransferred: 72,
  WrappedTransfer: 70,
  NewOwner: 15,
}

/**
 * Rank at or above which an event outranks the multi-record recipe: a
 * transaction that both registers a name and seeds its records is one "Register
 * name", not "Set 5 records". Deliberately above `ResolverUpdated` (60) — "set
 * the resolver and write records" is still best headlined by the records.
 *
 * This is protocol-agnostic on purpose: v2 registrations that seed records in
 * the same transaction headline as "Register name" too, which is the label
 * those rows should have had all along.
 */
const STRUCTURAL_RANK = 70

const RECORD_TYPES = new Set([
  'TextChanged',
  'AddressChanged',
  'AddrChanged',
  'ContenthashChanged',
])

const recordLabel = (event: TimelineIndexerEvent): string => {
  if (event.type === 'TextChanged')
    return event.asTextChanged?.key ?? event.key ?? 'text'
  if (event.type === 'ContenthashChanged') return 'content hash'
  return 'address'
}

const multiRecordRecipe = (
  group: readonly TimelineIndexerEvent[],
): Pick<Action, 'icon' | 'label' | 'slots'> | null => {
  const records = group.filter((event) => RECORD_TYPES.has(event.type))
  if (records.length < 2) return null

  const MAX_SHOWN = 4
  const slots: ActionSlot[] = records
    .slice(0, MAX_SHOWN)
    .map((event) => ({ kind: 'text' as const, value: recordLabel(event) }))
  if (records.length > MAX_SHOWN) {
    slots.push({
      kind: 'connective',
      value: `+${records.length - MAX_SHOWN} more`,
    })
  }

  return { icon: 'records', label: `Set ${records.length} records`, slots }
}

const rankOf = (event: TimelineIndexerEvent): number =>
  TYPE_RANK[event.type] ?? 0

/** Group events by transaction hash, preserving encounter order. */
const groupByTransaction = (
  events: readonly TimelineIndexerEvent[],
): TimelineIndexerEvent[][] => {
  const groups = new Map<string, TimelineIndexerEvent[]>()
  for (const event of events) {
    const key = event.transactionHash.toLowerCase()
    const group = groups.get(key)
    if (group) group.push(event)
    else groups.set(key, [event])
  }
  return [...groups.values()]
}

/**
 * Build the label/slots/icon for a group: the multi-record recipe first, then the
 * highest-ranked event whose descriptor produces a result, else a humanized fallback.
 */
const describeGroup = (
  group: readonly TimelineIndexerEvent[],
  byRank: readonly TimelineIndexerEvent[],
): Pick<Action, 'icon' | 'label' | 'slots'> => {
  const built = byRank.flatMap((primary) => {
    const descriptor = DESCRIPTORS[primary.type]
    const result = descriptor?.build(primary)
    return result
      ? [{ primary, ...result, icon: result.icon ?? descriptor.icon }]
      : []
  })

  if (!built[0] || rankOf(built[0].primary) < STRUCTURAL_RANK) {
    const fromRecipe = multiRecordRecipe(group)
    if (fromRecipe) return fromRecipe
  }

  if (built[0]) {
    const { primary: _primary, ...action } = built[0]
    return action
  }

  return {
    icon: 'default',
    label: humanizeType(byRank[0].type),
    slots: [],
  }
}

/** Turn a flat list of raw indexer events into tier-1 semantic actions, one per transaction. */
export const summarizeEvents = (
  events: readonly TimelineIndexerEvent[],
): Action[] => {
  const relevant = events.filter((event) => !IGNORED_TYPES.has(event.type))

  const actions = groupByTransaction(relevant).map((group): Action => {
    const byRank = [...group].sort((a, b) => rankOf(b) - rankOf(a))
    return {
      txHash: group[0].transactionHash,
      timestamp: Math.max(...group.map((event) => event.timestamp)),
      events: group,
      ...describeGroup(group, byRank),
    }
  })

  return actions.sort((a, b) => b.timestamp - a.timestamp)
}
