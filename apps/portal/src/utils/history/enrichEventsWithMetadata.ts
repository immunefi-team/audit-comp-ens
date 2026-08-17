import type { Address, Hash } from 'viem'
import type {
  BaseEvent,
  EventsTableData,
} from '@/components/table/EventsDataTable/types'

/**
 * Enriches events data with timestamps and transaction sender addresses
 *
 * For each event:
 * - Preserves existing timestamp, or adds from timestampsData Map based on block number
 * - Adds/updates sender address from sendersData Map, falling back to existing `from` field
 *
 * @param eventsData - Array of event transaction data
 * @param timestampsData - Map of block numbers to timestamps (in seconds as bigint)
 * @param sendersData - Map of transaction hashes to sender addresses
 * @returns Enriched events data array, or empty array if metadata is missing
 *
 * @example
 * const events = [{ transactionID: '0x123', blockNumber: 100, events: [...] }]
 * const timestamps = new Map([[100n, 1678886400n]])
 * const senders = new Map([['0x123', '0xabc...']])
 *
 * const enriched = enrichEventsWithMetadata(events, timestamps, senders)
 * // [{ transactionID: '0x123', blockNumber: 100, timestamp: 1678886400n, from: '0xabc...', events: [...] }]
 */
export const enrichEventsWithMetadata = <TEvent extends BaseEvent = BaseEvent>(
  eventsData: EventsTableData<TEvent>[],
  timestampsData: Map<bigint, bigint> | undefined,
  sendersData: Map<Hash, Address> | undefined,
): EventsTableData<TEvent>[] => {
  if (!timestampsData || !sendersData) return []

  return eventsData.map((tx) => ({
    ...tx,
    timestamp: tx.timestamp || timestampsData.get(BigInt(tx.blockNumber)),
    from: sendersData.get(tx.transactionID as Hash) || tx.from,
  }))
}
