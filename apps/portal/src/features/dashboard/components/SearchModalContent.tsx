import { useCallback, useMemo } from 'react'
import { CommandEmpty, CommandList } from '@/components/ui/command'
import { useSearchResults } from '../hooks/useSearchResults'
import type { Suggestion } from '../utils/buildSearchSuggestions'
import { SearchResultsList } from './SearchResultsList'

export type SearchModalContentProps = {
  /** Trimmed, debounced search value */
  searchValue: string
  onSelectSuggestion: (suggestion: Suggestion) => void
  onSelectOwnedName?: (name: string) => void
  onSelectAvailableName?: (name: string) => void
  navigateToName: (name: string) => void
  navigateToAddress: (address: string) => void
  navigateToResolver: (address: string) => void
}

export const SearchModalContent = ({
  searchValue,
  onSelectSuggestion,
  onSelectOwnedName,
  onSelectAvailableName,
  navigateToName,
  navigateToAddress,
  navigateToResolver,
}: SearchModalContentProps) => {
  const {
    suggestions,
    ownerBySuggestionId,
    availableNames,
    pendingAvailabilityIds,
    ownedNamesFiltered,
    isTldsLoading,
    hasAnySection,
    searchNotice,
  } = useSearchResults({
    searchValue,
    navigateToName,
    navigateToAddress,
    navigateToResolver,
  })

  const availableNameIds = useMemo(
    () => new Set(availableNames.map((s) => s.id)),
    [availableNames],
  )

  const handleSelect = useCallback(
    (value: string) => {
      if (value.startsWith('owned:')) {
        onSelectOwnedName?.(value.slice('owned:'.length))
        return
      }
      const suggestion = suggestions.find((s) => s.id === value)
      if (!suggestion) return
      if (onSelectAvailableName && availableNameIds.has(suggestion.id)) {
        onSelectAvailableName(suggestion.inputValue)
      } else {
        onSelectSuggestion(suggestion)
      }
    },
    [
      suggestions,
      availableNameIds,
      onSelectSuggestion,
      onSelectOwnedName,
      onSelectAvailableName,
    ],
  )

  return (
    <CommandList>
      <CommandEmpty>
        {searchValue
          ? (searchNotice ?? 'No results found.')
          : 'Type to search for names or addresses...'}
      </CommandEmpty>
      <SearchResultsList
        suggestions={suggestions}
        ownerBySuggestionId={ownerBySuggestionId}
        availableNames={availableNames}
        pendingAvailabilityIds={pendingAvailabilityIds}
        ownedNamesFiltered={ownedNamesFiltered}
        onSelect={handleSelect}
        variant="command"
      />
      {searchValue && isTldsLoading && !hasAnySection && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          Checking supported TLDs…
        </div>
      )}
    </CommandList>
  )
}
