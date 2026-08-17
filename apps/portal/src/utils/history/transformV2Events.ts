import type { V2Event } from '@/features/address/components/hooks/useV2HistoryForAddress'
import type { SubgraphEvent } from './groupEventsByTransactionId'

/**
 * Transforms V2 events from the GraphQL indexer to the SubgraphEvent format
 * used by V1, allowing both to work with the same components and utilities.
 *
 * Key transformations:
 * - transactionHash → transactionID
 * - name → id (V2 uses event name as identifier)
 * - timestamp (seconds) → timestamp (bigint)
 *
 * @param v2Events - Array of V2 events from GraphQL
 * @returns Array of events in SubgraphEvent format
 *
 * @example
 * const v2Events = [{ name: 'Transfer', type: 'Transfer', transactionHash: '0x...', timestamp: 1234567890, blockNumber: 100 }]
 * const subgraphEvents = transformV2EventsToSubgraphFormat(v2Events)
 * // [{ id: 'Transfer', type: 'Transfer', transactionID: '0x...', timestamp: 1234567890n, blockNumber: 100 }]
 */
export const transformV2EventsToSubgraphFormat = (
  v2Events: V2Event[],
): SubgraphEvent[] => {
  return v2Events.map((event) => ({
    transactionID: event.transactionHash,
    blockNumber: event.blockNumber,
    id: event.name,
    type: event.type,
    timestamp: BigInt(event.timestamp),
  }))
}
