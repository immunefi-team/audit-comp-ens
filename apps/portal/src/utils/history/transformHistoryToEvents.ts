import type { GetNameHistoryReturnType } from '@ensdomains/ensjs/subgraph'
import type { Address } from 'viem'
import type {
  BaseEvent,
  EventsTableData,
} from '@/components/table/EventsDataTable'
import {
  extractEventAddress,
  findAddressFromEvents,
} from './extractEventAddress'

/**
 * ENS-specific event type
 */
export type ENSEvent = BaseEvent<Record<string, unknown>>

/**
 * Transform ENS history data into the generic EventsTableData format
 * Groups events by transaction ID and extracts relevant information
 */
export const transformHistoryToEvents = (
  history: GetNameHistoryReturnType,
): EventsTableData<ENSEvent>[] => {
  if (!history) return []

  const transactionMap = new Map<
    string,
    {
      transactionID: string
      blockNumber: number
      from: Address | null
      events: BaseEvent[]
    }
  >()

  // Process domain events
  history.domainEvents.forEach((event) => {
    if (!transactionMap.has(event.transactionID)) {
      transactionMap.set(event.transactionID, {
        transactionID: event.transactionID,
        blockNumber: event.blockNumber,
        from: extractEventAddress(event),
        events: [],
      })
    }
    const tx = transactionMap.get(event.transactionID)
    if (!tx) return
    if (!tx.from) {
      tx.from = extractEventAddress(event)
    }
    tx.events.push({
      id: event.id,
      type: event.type,
      category: 'domain',
      details: event,
    })
  })

  // Process registration events
  history.registrationEvents?.forEach((event) => {
    if (!transactionMap.has(event.transactionID)) {
      transactionMap.set(event.transactionID, {
        transactionID: event.transactionID,
        blockNumber: event.blockNumber,
        from: extractEventAddress(event),
        events: [],
      })
    }
    const tx = transactionMap.get(event.transactionID)
    if (!tx) return
    if (!tx.from) {
      tx.from = extractEventAddress(event)
    }
    tx.events.push({
      id: event.id,
      type: event.type,
      category: 'registration',
      details: event,
    })
  })

  // Process resolver events
  history.resolverEvents?.forEach((event) => {
    if (!transactionMap.has(event.transactionID)) {
      transactionMap.set(event.transactionID, {
        transactionID: event.transactionID,
        blockNumber: event.blockNumber,
        from: extractEventAddress(event),
        events: [],
      })
    }
    const tx = transactionMap.get(event.transactionID)
    if (!tx) return
    if (!tx.from) {
      tx.from = extractEventAddress(event)
    }
    tx.events.push({
      id: event.id,
      type: event.type,
      category: 'resolver',
      details: event,
    })
  })

  // Convert map to array and ensure all transactions have a "from" address
  return Array.from(transactionMap.values())
    .map((tx) => ({
      ...tx,
      from: tx.from || findAddressFromEvents(tx.events),
      // Network will be populated when we have chain info from subgraph
      // For now, it will use the default network from config
      network: undefined,
    }))
    .sort((a, b) => b.blockNumber - a.blockNumber)
}
