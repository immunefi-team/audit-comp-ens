import type { ReturnResolverEvent } from '@ensdomains/ensjs/subgraph'
import { match } from 'ts-pattern'
import type { V2NameHistoryEvent } from '@/features/profile/hooks/useV2NameHistory'
import type { NameRecord } from '@/features/records/components/RecordsTable/columns'

/**
 * Unified history event type for display in the record history table.
 */
export type HistoryEvent = {
  blockNumber: number
  timestamp?: number // Unix timestamp in seconds
  transactionHash: string
  type: string
  value?: string
}

/**
 * Gets the V2 event types that correspond to a record type.
 * Note: V2 indexer uses different event names than V1 (e.g., AddressChanged vs AddrChanged)
 *
 * @param record - The record to get event types for
 * @returns Array of event type strings that match the record type
 *
 * @example
 * getV2EventTypesForRecord({ type: 'text', key: 'name', value: 'John' })
 * // ['TextChanged']
 *
 * @example
 * getV2EventTypesForRecord({ type: 'address', key: 'ETH', value: '0x...', id: 60 })
 * // ['AddressChanged']
 */
export const getV2EventTypesForRecord = (record: NameRecord): string[] =>
  match(record.type)
    .with('text', () => ['TextChanged'])
    .with('address', () => ['AddressChanged'])
    .with('contentHash', () => ['ContenthashChanged'])
    .with('abi', () => ['ABIChanged'])
    .exhaustive()

/**
 * Filters V2 name history events to only include resolver events matching the record type.
 * Note: V2 events don't have detailed key/coinType info, so we can only filter by event type.
 *
 * @param events - Array of V2 name history events
 * @param record - The record to filter events for
 * @returns Filtered events matching the record's type
 *
 * @example
 * filterV2EventsByRecord(events, { type: 'text', key: 'name', value: 'John' })
 * // Returns only events with type 'TextChanged'
 */
export const filterV2EventsByRecord = (
  events: V2NameHistoryEvent[],
  record: NameRecord,
): V2NameHistoryEvent[] => {
  const eventTypes = getV2EventTypesForRecord(record)
  return events.filter((event) => eventTypes.includes(event.type))
}

/**
 * Extracts the display value from a V1 resolver event.
 *
 * @param event - The resolver event to extract value from
 * @returns The display value string or undefined
 */
const extractV1EventValue = (event: ReturnResolverEvent): string | undefined =>
  match(event)
    .with({ type: 'ContenthashChanged' }, (e) => e.contentHash ?? undefined)
    .with({ type: 'TextChanged' }, (e) => `${e.key}: ${e.value ?? 'null'}`)
    .with({ type: 'AddrChanged' }, (e) => e.addr ?? undefined)
    .with({ type: 'MulticoinAddrChanged' }, (e) => e.addr ?? undefined)
    .otherwise(() => undefined)

/**
 * Transforms V1 resolver events to the unified HistoryEvent format.
 * V1 events don't include timestamps, so they must be provided from block data.
 *
 * @param events - Array of V1 resolver events
 * @param blockTimestamps - Optional map of block numbers to timestamps
 * @returns Array of unified history events
 *
 * @example
 * const timestamps = new Map([[BigInt(12345), BigInt(1700000000)]])
 * transformV1Events([{ type: 'TextChanged', key: 'name', value: 'John', blockNumber: 12345, ... }], timestamps)
 * // [{ blockNumber: 12345, timestamp: 1700000000, type: 'TextChanged', value: 'name: John' }]
 */
export const transformV1Events = (
  events: ReturnResolverEvent[],
  blockTimestamps?: Map<bigint, bigint>,
): HistoryEvent[] =>
  events.map((event) => {
    const blockTimestamp = blockTimestamps?.get(BigInt(event.blockNumber))
    return {
      blockNumber: event.blockNumber,
      timestamp: blockTimestamp ? Number(blockTimestamp) : undefined,
      transactionHash: event.transactionID,
      type: event.type,
      value: extractV1EventValue(event),
    }
  })

/**
 * Transforms V2 name history events to the unified HistoryEvent format.
 * V2 events include timestamps but not detailed value info (the indexer schema
 * doesn't include key, value, addr, contentHash fields on events).
 *
 * @param events - Array of V2 name history events
 * @returns Array of unified history events
 *
 * @example
 * transformV2Events([{ type: 'TextChanged', blockNumber: 12345, timestamp: 1700000000, name: 'test.eth', transactionHash: '0x...' }])
 * // [{ blockNumber: 12345, timestamp: 1700000000, type: 'TextChanged', value: undefined }]
 */
export const transformV2Events = (
  events: V2NameHistoryEvent[],
): HistoryEvent[] =>
  events.map((event) => ({
    blockNumber: event.blockNumber,
    timestamp: event.timestamp,
    transactionHash: event.transactionHash,
    type: event.type,
    value: undefined,
  }))

/**
 * Sorts history events by timestamp (descending), falling back to block number.
 * Most recent events appear first.
 *
 * @param events - Array of history events to sort
 * @returns Sorted array (creates a new array, does not mutate input)
 *
 * @example
 * sortHistoryEvents([
 *   { blockNumber: 100, timestamp: 1000, type: 'A', value: 'a' },
 *   { blockNumber: 200, timestamp: 2000, type: 'B', value: 'b' },
 * ])
 * // [{ blockNumber: 200, timestamp: 2000, ... }, { blockNumber: 100, timestamp: 1000, ... }]
 */
export const sortHistoryEvents = (events: HistoryEvent[]): HistoryEvent[] =>
  [...events].sort((a, b) => {
    // Prefer timestamp if both events have it
    if (a.timestamp && b.timestamp) {
      return b.timestamp - a.timestamp
    }
    // Fallback to block number
    return b.blockNumber - a.blockNumber
  })
