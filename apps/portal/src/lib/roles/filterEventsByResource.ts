import type { Address, Hex } from 'viem'
import { getAddress } from 'viem'
import { decodeRoleBitmap } from '@/lib/roles/decodeRoleBitmap'

export type IndexerEACEvent = {
  readonly type: string
  readonly data: string
  readonly transactionHash: Hex
  readonly timestamp: number
  readonly blockNumber: number
}

type EACRolesChangedData = {
  readonly resource: string
  readonly account: string
  readonly oldRoleBitmap: string
  readonly newRoleBitmap: string
}

export type RoleHistoryEntry = {
  readonly account: Address
  readonly resource: string
  readonly oldRoles: readonly string[]
  readonly newRoles: readonly string[]
  readonly transactionHash: Hex
  readonly timestamp: number
  readonly blockNumber: number
}

/**
 * Filters EAC events by resource and transforms them into RoleHistoryEntry objects.
 * Sorts results by most recent block first.
 *
 * @param events - Array of indexer EAC events
 * @param resource - Optional resource hex to filter by (case-insensitive)
 * @returns Array of RoleHistoryEntry objects sorted by block number descending
 */
// Resources are uint256 values, so compare numerically — the same value can be
// encoded differently (e.g. ROOT_RESOURCE as "0x0" from the indexer vs the
// 32-byte-padded zero callers build). Falls back to case-insensitive string
// compare for any non-numeric resource.
const resourcesMatch = (a: string, b: string): boolean => {
  try {
    return BigInt(a) === BigInt(b)
  } catch {
    return a.toLowerCase() === b.toLowerCase()
  }
}

export const filterEventsByResource = (
  events: readonly IndexerEACEvent[],
  resource?: string,
): RoleHistoryEntry[] => {
  const filtered: RoleHistoryEntry[] = []

  for (const event of events) {
    if (!event.data) continue

    const data = JSON.parse(event.data) as EACRolesChangedData
    if (!data.resource || !data.account) continue

    if (resource && !resourcesMatch(data.resource, resource)) continue

    filtered.push({
      account: getAddress(data.account),
      resource: data.resource,
      oldRoles: decodeRoleBitmap(data.oldRoleBitmap),
      newRoles: decodeRoleBitmap(data.newRoleBitmap),
      transactionHash: event.transactionHash,
      timestamp: event.timestamp,
      blockNumber: event.blockNumber,
    })
  }

  // Sort by most recent first
  return filtered.toSorted((a, b) => b.blockNumber - a.blockNumber)
}
