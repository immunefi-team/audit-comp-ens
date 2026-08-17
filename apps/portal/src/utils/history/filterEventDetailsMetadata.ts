/**
 * Metadata field names that should be filtered out from event details
 * when displaying event data to users
 */
const METADATA_FIELDS = ['id', 'blockNumber', 'transactionID', 'type'] as const

/**
 * Filters out metadata fields from event details, returning only
 * the actual event-specific data fields.
 *
 * @param details - The full event details object
 * @returns Array of [key, value] tuples with metadata fields removed
 *
 * @example
 * filterEventDetailsMetadata({
 *   id: "event-1",
 *   blockNumber: 123,
 *   transactionID: "0xabc",
 *   type: "Transfer",
 *   from: "0x123",
 *   to: "0x456",
 *   amount: "1000"
 * })
 * // [["from", "0x123"], ["to", "0x456"], ["amount", "1000"]]
 */
export const filterEventDetailsMetadata = (
  details: Record<string, unknown>,
): Array<[string, unknown]> => {
  return Object.entries(details).filter(
    ([key]) =>
      !METADATA_FIELDS.includes(key as (typeof METADATA_FIELDS)[number]),
  )
}
