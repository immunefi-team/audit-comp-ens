import type { Address } from 'viem'

/**
 * Extracts an address from a history event
 * Checks common address fields: owner, registrant, newOwner
 * Note: Does NOT check 'addr' field as that contains resolver address records (Bitcoin, etc.), not transaction senders
 * Note: Many resolver events (TextChanged, AddrChanged, etc.) don't have sender info in subgraph data
 */
export const extractEventAddress = (event: unknown): Address | null => {
  const evt = event as Record<string, unknown>

  if (evt.owner && typeof evt.owner === 'string') {
    return evt.owner as Address
  }
  if (evt.registrant && typeof evt.registrant === 'string') {
    return evt.registrant as Address
  }
  if (evt.newOwner && typeof evt.newOwner === 'string') {
    return evt.newOwner as Address
  }

  return null
}

/**
 * Finds the first valid address from a list of events
 */
export const findAddressFromEvents = (
  events: Array<{ details: unknown }>,
): Address | null => {
  for (const event of events) {
    const addr = extractEventAddress(event.details)
    if (addr) return addr
  }
  return null
}
