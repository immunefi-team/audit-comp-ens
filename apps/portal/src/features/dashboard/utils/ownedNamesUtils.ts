/**
 * Pure helpers for merging and ordering "Names you own" in search.
 * Ordering: 2LD names (e.g. fox.eth, arcticfox.eth) first, then subnames (e.g. big.fox.eth), alphabetically within each group.
 */

export type OwnedName = { name: string }

export type V1NameLike = { name: string | null }

/**
 * Merges V1 and V2 owned name lists and deduplicates by name (case-insensitive).
 * V1 entries with null name are skipped.
 */
export function mergeOwnedNames(
  v1: V1NameLike[],
  v2: OwnedName[],
): OwnedName[] {
  const v1Filtered = v1
    .filter((d): d is V1NameLike & { name: string } => d.name != null)
    .map((d) => ({ name: d.name }))
  const byName = new Map<string, OwnedName>()
  for (const d of [...v1Filtered, ...v2]) {
    const key = d.name.trim().toLowerCase()
    if (!byName.has(key)) byName.set(key, d)
  }
  return Array.from(byName.values())
}

/**
 * Number of labels in an ENS name (e.g. "fox.eth" -> 2, "big.fox.eth" -> 3).
 */
export function labelCount(name: string): number {
  return name.trim().split('.').length
}

/**
 * True when the name has exactly two labels (e.g. fox.eth, arcticfox.eth).
 */
export function is2LD(name: string): boolean {
  return labelCount(name) === 2
}

export type FilterAndSortOwnedNamesOptions = {
  /** Max number of names to return (default: no limit). */
  max?: number
}

/**
 * Filters owned names by search query (includes, case-insensitive, trimmed)
 * and sorts: 2LD names first, then subnames (3+ labels), then alphabetically by name within each group.
 *
 * The TLD suffix (e.g. ".eth") is stripped from the query before matching so
 * that searching "dom.eth" still finds "dominico.eth".
 */
export function filterAndSortOwnedNames(
  ownedNames: OwnedName[],
  searchQuery: string,
  options: FilterAndSortOwnedNamesOptions = {},
): OwnedName[] {
  const q = searchQuery.trim().toLowerCase()
  if (!q) return []

  // Strip a short TLD-like suffix (e.g. "dom.eth" → "dom") but preserve longer
  // subname labels (e.g. "test.florin" stays "test.florin", not "test").
  const lastDot = q.lastIndexOf('.')
  const afterLastDot = lastDot >= 0 ? q.slice(lastDot + 1) : ''
  const MAX_TLD_LENGTH = 3
  const shouldStripSuffix =
    afterLastDot === '' || afterLastDot.length <= MAX_TLD_LENGTH
  const matchQuery = shouldStripSuffix && lastDot >= 0 ? q.slice(0, lastDot) : q
  if (!matchQuery) return []

  const matching = ownedNames.filter((d) =>
    d.name.trim().toLowerCase().includes(matchQuery),
  )

  const normalized = (name: string) => name.trim().toLowerCase()

  const sorted = [...matching].sort((a, b) => {
    const a2 = is2LD(a.name)
    const b2 = is2LD(b.name)
    if (a2 && !b2) return -1
    if (!a2 && b2) return 1
    return normalized(a.name).localeCompare(normalized(b.name))
  })

  const { max } = options
  return max !== undefined ? sorted.slice(0, max) : sorted
}
