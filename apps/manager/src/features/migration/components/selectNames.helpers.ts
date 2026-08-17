import type { ClassifiedName } from '../service/classifyNames'
import type { NameGroup } from '../service/groupByParent'

export const BULK_SELECTION_THRESHOLD = 15
export const NAME_SEARCH_THRESHOLD = 9
export const SMALL_SELECTION_LAYOUT_THRESHOLD = 6
export const COMPACT_SELECTION_LAYOUT_THRESHOLD = 10

export const shouldShowBulkSelection = (eligibleCount: number): boolean =>
  eligibleCount >= BULK_SELECTION_THRESHOLD

export const shouldShowNameSearch = (eligibleCount: number): boolean =>
  eligibleCount >= NAME_SEARCH_THRESHOLD

export const shouldUseCompactSelectionLayout = (
  eligibleCount: number,
): boolean => eligibleCount >= COMPACT_SELECTION_LAYOUT_THRESHOLD

export const shouldUseSmallSelectionCard = (eligibleCount: number): boolean =>
  eligibleCount > 0 && eligibleCount <= SMALL_SELECTION_LAYOUT_THRESHOLD

export const collectAllSelectable = (
  groups: readonly NameGroup[],
  orphans: readonly ClassifiedName[],
): Set<string> => {
  const all = new Set<string>()
  for (const group of groups) {
    all.add(group.parent.domain.name)
    for (const sub of group.subnames) all.add(sub.domain.name)
  }
  for (const orphan of orphans) all.add(orphan.domain.name)
  return all
}

export const toggleName = (
  prev: ReadonlySet<string>,
  name: string,
): Set<string> => {
  const next = new Set(prev)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  return next
}

export const toggleGroup = (
  prev: ReadonlySet<string>,
  parentName: string,
  subnameNames: readonly string[],
): Set<string> => {
  const next = new Set(prev)
  if (next.has(parentName)) {
    next.delete(parentName)
    for (const sub of subnameNames) next.delete(sub)
  } else {
    next.add(parentName)
    for (const sub of subnameNames) next.add(sub)
  }
  return next
}

const matchesQuery = (name: string, q: string): boolean =>
  name.toLowerCase().includes(q)

export const filterGroupsBySearch = (
  groups: readonly NameGroup[],
  searchLower: string,
): readonly NameGroup[] => {
  if (!searchLower) return groups
  return groups.filter(
    (g) =>
      matchesQuery(g.parent.domain.name, searchLower) ||
      g.subnames.some((s) => matchesQuery(s.domain.name, searchLower)),
  )
}

export const filterOrphansBySearch = (
  orphans: readonly ClassifiedName[],
  searchLower: string,
): readonly ClassifiedName[] => {
  if (!searchLower) return orphans
  return orphans.filter((o) => matchesQuery(o.domain.name, searchLower))
}

export const countVisibleRows = (
  groups: readonly NameGroup[],
  orphans: readonly ClassifiedName[],
): number =>
  groups.reduce((acc, g) => acc + 1 + g.subnames.length, 0) + orphans.length
