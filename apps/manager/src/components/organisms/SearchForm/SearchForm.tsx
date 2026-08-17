import { useState } from 'react'
import { Text } from '@/components/ui/text'
import { SearchField } from '../../molecules/SearchField'

export interface SearchFormProps {
  placeholder?: string
  onSearch: (query: string) => void
  loading?: boolean
  recentSearches?: string[]
  onRecentSearchSelect?: (query: string) => void
  showRecentSearches?: boolean
}

export const SearchForm = ({
  placeholder = 'Search for a domain name...',
  onSearch,
  // loading = false,
  recentSearches = [],
  onRecentSearchSelect,
  // showRecentSearches = true,
}: SearchFormProps) => {
  const [query, setQuery] = useState('')
  const [showRecent, setShowRecent] = useState(false)

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim())
      setShowRecent(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }

  // const handleInputFocus = () => {
  //   if (showRecentSearches && recentSearches.length > 0) {
  //     setShowRecent(true)
  //   }
  // }

  // const handleInputBlur = () => {
  //   setTimeout(() => setShowRecent(false), 150)
  // }

  const handleRecentSearchClick = (recentQuery: string) => {
    setQuery(recentQuery)
    onRecentSearchSelect?.(recentQuery)
    handleSearch(recentQuery)
  }

  return (
    <div className="relative w-full">
      <SearchField
        onChange={handleInputChange}
        onSearch={handleSearch}
        // TODO: Add this back in with fixed SearchField component
        // onFocus={handleInputFocus}
        // onBlur={handleInputBlur}
        placeholder={placeholder}
        value={query}
        // buttonProps={{
        //   loading,
        //   disabled: !query.trim() || loading,
        // }}
        // size="lg"
      />

      {showRecent && recentSearches.length > 0 && (
        <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
          <div className="border-border border-b px-4 py-3">
            <Text color="secondary" variant="caption" weight="medium">
              Recent Searches
            </Text>
          </div>
          {recentSearches.map((recentQuery) => (
            <button
              className="w-full px-4 py-3 text-left text-base text-foreground transition-colors duration-200 hover:bg-secondary"
              key={recentQuery}
              onClick={() => handleRecentSearchClick(recentQuery)}
              type="button"
            >
              {recentQuery}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

SearchForm.displayName = 'SearchForm'
