/**
 * Parses the log index from an ENS event ID.
 * Event IDs have the format: "{txHash}-{logIndex}"
 *
 * @param eventId - The event ID (e.g., "0xabc123-5")
 * @returns The parsed log index as a number, or NaN if invalid
 *
 * @example
 * parseEventLogIndex("0xabc123-5")
 * // 5
 *
 * @example
 * parseEventLogIndex("0xabc123-42")
 * // 42
 *
 * @example
 * parseEventLogIndex("invalid")
 * // NaN
 *
 * @example
 * parseEventLogIndex(null)
 * // NaN
 */
export const parseEventLogIndex = (
  eventId: string | null | undefined,
): number => {
  if (!eventId) {
    return Number.NaN
  }
  const logIndex = eventId.split('-')[1]
  return Number.parseInt(logIndex, 10)
}
