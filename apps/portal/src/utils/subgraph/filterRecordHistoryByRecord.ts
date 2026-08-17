import type { ReturnResolverEvent } from '@ensdomains/ensjs/subgraph'
import { match } from 'ts-pattern'
import type { NameRecord } from '@/features/records/components/RecordsTable/columns'

/**
 * Filters resolver events to only include those matching the given record.
 *
 * @param events - Array of resolver events from the subgraph
 * @param record - The record to filter events for
 * @returns Filtered events matching the record's type and key/coinType
 *
 * @example
 * // For a text record with key "email"
 * filterRecordHistoryByRecord(events, { type: 'text', key: 'email', value: '...' })
 * // Returns only TextChanged events where event.key === 'email'
 *
 * @example
 * // For an ETH address record (coin type 60)
 * filterRecordHistoryByRecord(events, { type: 'address', key: 'ETH', value: '...', id: 60 })
 * // Returns AddrChanged events (ETH only) and other non-targeted events
 */
export const filterRecordHistoryByRecord = (
  events: ReturnResolverEvent[],
  record: NameRecord,
): ReturnResolverEvent[] => {
  return events.filter(
    (event) =>
      match(event)
        .with({ type: 'AddrChanged' }, () => {
          // AddrChanged is for the default ETH address (coin type 60)
          return record.type === 'address' && record.id === 60
        })
        .with({ type: 'MulticoinAddrChanged' }, (e) => {
          // MulticoinAddrChanged has a coinType field to match against record.id
          return record.type === 'address' && record.id === Number(e.coinType)
        })
        .with({ type: 'TextChanged' }, (e) => {
          // TextChanged must match the record's key
          return record.type === 'text' && record.key === e.key
        })
        .otherwise(() => true), // Include all other event types
  )
}
