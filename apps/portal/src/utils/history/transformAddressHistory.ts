import type { Hash } from 'viem'
import type {
  BaseEvent,
  EventsTableData,
} from '@/components/table/EventsDataTable/types'
import { groupEventsByTransactionId } from './groupEventsByTransactionId'
import type { ENSEvent } from './transformHistoryToEvents'

/**
 * V1 event types from subgraph
 */
export type V1EventBase = {
  id: string
  transactionID: string
  blockNumber: number
  type: string
}

export type V1Events = {
  domainEvents: V1EventBase[]
  registrationEvents: V1EventBase[]
  resolverEvents: V1EventBase[]
}

/**
 * V2 event type from subgraph
 */
export type V2Event = {
  transactionHash: string
  blockNumber: number
  name: string
  type: string
  timestamp: number
}

/**
 * Transforms V1 events (domain, registration, resolver) into common format
 * Groups events by transaction ID
 */
export const transformV1EventsToCommon = (
  v1Events?: V1Events,
): EventsTableData<ENSEvent>[] => {
  if (!v1Events) return []

  // Flatten all V1 events into a single array
  const allEvents: Array<V1EventBase & { category: string }> = [
    ...(v1Events.domainEvents || []).map((e) => ({
      ...e,
      category: 'domain' as const,
    })),
    ...(v1Events.registrationEvents || []).map((e) => ({
      ...e,
      category: 'registration' as const,
    })),
    ...(v1Events.resolverEvents || []).map((e) => ({
      ...e,
      category: 'resolver' as const,
    })),
  ]

  // Group all events by transaction ID (not individually)
  return groupEventsByTransactionId(allEvents, 'domain')
}

/**
 * Transforms V2 events into common format
 * Groups events by transaction ID and includes timestamp
 */
export const transformV2EventsToCommon = (
  v2Events?: V2Event[],
): EventsTableData<ENSEvent>[] => {
  if (!v2Events) return []

  const v2SubgraphFormat = v2Events.map((event) => ({
    transactionID: event.transactionHash,
    blockNumber: event.blockNumber,
    id: event.name,
    type: event.type,
    timestamp: BigInt(event.timestamp),
  }))

  return groupEventsByTransactionId(v2SubgraphFormat, 'domain')
}

/**
 * Transforms and merges V1 and V2 events into a single sorted array
 * This is a convenience function that combines transformation and merging
 */
export const transformAndMergeAddressHistory = (
  v1Events?: V1Events,
  v2Events?: V2Event[],
): EventsTableData<ENSEvent>[] => {
  const v1Transformed = transformV1EventsToCommon(v1Events)
  const v2Transformed = transformV2EventsToCommon(v2Events)

  const merged = [...v1Transformed, ...v2Transformed]
  return merged.sort((a, b) => b.blockNumber - a.blockNumber)
}

/**
 * @deprecated Use transformAndMergeAddressHistory instead
 * Merges V1 and V2 events and sorts by block number descending
 */
export const mergeAndSortEvents = <TEvent extends BaseEvent = ENSEvent>(
  v1Events: EventsTableData<TEvent>[],
  v2Events: EventsTableData<TEvent>[],
): EventsTableData<TEvent>[] => {
  const merged = [...v1Events, ...v2Events]
  return merged.sort((a, b) => b.blockNumber - a.blockNumber)
}

/**
 * Extracts block numbers that need timestamp lookups
 * Filters out events that already have timestamps
 */
export const extractBlocksNeedingTimestamps = <TEvent extends BaseEvent>(
  events: EventsTableData<TEvent>[],
): bigint[] => {
  return events
    .filter((tx) => !tx.timestamp)
    .map((tx) => BigInt(tx.blockNumber))
}

/**
 * Extracts transaction hashes for sender lookups
 */
export const extractTransactionHashes = <TEvent extends BaseEvent>(
  events: EventsTableData<TEvent>[],
): Hash[] => {
  return events.map((tx) => tx.transactionID as Hash)
}
