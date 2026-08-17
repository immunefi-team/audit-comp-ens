import type { Suggestion } from './buildSearchSuggestions'

/**
 * Flat item for keyboard nav and selection: suggestions, then owned names.
 */
export type SearchResultItem =
  | { type: 'suggestion'; value: string; suggestion: Suggestion }
  | { type: 'owned'; value: string; name: string }

export type BuildSearchResultItemsParams = {
  suggestions: Suggestion[]
  ownedNamesFiltered: Array<{ name: string }>
}

/**
 * Builds the flat list of search result items in display order:
 * suggestions first, then owned names.
 */
export function buildSearchResultItems({
  suggestions,
  ownedNamesFiltered,
}: BuildSearchResultItemsParams): SearchResultItem[] {
  const items: SearchResultItem[] = []
  for (const s of suggestions) {
    items.push({ type: 'suggestion', value: s.id, suggestion: s })
  }
  for (const d of ownedNamesFiltered) {
    items.push({ type: 'owned', value: `owned:${d.name}`, name: d.name })
  }
  return items
}
