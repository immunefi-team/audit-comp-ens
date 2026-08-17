import type { TimelineIndexerEvent } from './hooks/useNameHistoryTimeline'

/**
 * Cap the feed at `limit` events without splitting a transaction.
 *
 * The page limit is deliberate, but it cannot be applied to the flat event list:
 * `summarizeEvents` groups by transaction afterwards, so a cutoff landing inside
 * a transaction would summarize it from a subset of its events — the wrong
 * headline (a registration whose `NameRegistered` was cut reads as "Set N
 * records") and missing detail rows, with no indication anything was dropped.
 *
 * Whole transactions are taken until the next one would exceed the limit, so the
 * result is at most `limit` events and every action it contains is complete. A
 * single transaction larger than the limit is kept whole rather than emptying
 * the timeline.
 *
 * `events` must already be sorted; group order follows first appearance.
 */
export const truncateToTransactions = (
  events: readonly TimelineIndexerEvent[],
  limit: number,
): TimelineIndexerEvent[] => {
  const byTransaction = new Map<string, TimelineIndexerEvent[]>()
  for (const event of events) {
    const key = event.transactionHash.toLowerCase()
    const group = byTransaction.get(key)
    if (group) group.push(event)
    else byTransaction.set(key, [event])
  }

  const kept: TimelineIndexerEvent[] = []
  for (const group of byTransaction.values()) {
    if (kept.length > 0 && kept.length + group.length > limit) break
    kept.push(...group)
  }
  return kept
}
