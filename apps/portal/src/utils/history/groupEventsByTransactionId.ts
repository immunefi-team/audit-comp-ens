import type { Address } from 'viem/accounts'
import type { BaseEventCategory } from '@/components/table/EventsDataTable/types'
import {
  extractEventAddress,
  findAddressFromEvents,
} from './extractEventAddress'
import type { ENSEvent } from './transformHistoryToEvents'

export type SubgraphEvent = {
  transactionID: string
  blockNumber: number
  id: ENSEvent['id']
  type: ENSEvent['type']
  timestamp?: bigint
}

export const groupEventsByTransactionId = (
  events: SubgraphEvent[],
  category: BaseEventCategory,
) => {
  const transactionMap = new Map<
    string,
    {
      transactionID: string
      blockNumber: number
      timestamp?: bigint
      from: Address | null
      events: ENSEvent[]
    }
  >()

  events.forEach((event) => {
    if (!transactionMap.has(event.transactionID)) {
      transactionMap.set(event.transactionID, {
        transactionID: event.transactionID,
        blockNumber: event.blockNumber,
        timestamp: event.timestamp,
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
      details: event,
      category,
    })
  })

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
