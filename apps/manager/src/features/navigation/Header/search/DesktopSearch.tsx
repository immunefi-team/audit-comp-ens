import { Popover } from '@base-ui/react'
import { useRef, useState } from 'react'
import { useOpenFirstSearchResultHotkey } from '@/features/navigation/Header/search/useOpenFirstSearchResultHotkey'
import { useDebounce } from '@/hooks/useDebounce'
import { SearchInput } from './SearchInput'
import { SearchSuggestions } from './SearchSuggestions'

export const DesktopSearch = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsContainerRef = useRef<HTMLDivElement>(null)
  const { debouncedValue: debouncedSearchValue } = useDebounce(searchValue, {
    delay: 500,
  })

  const resetSearch = () => {
    setIsOpen(false)
    setSearchValue('')
  }

  useOpenFirstSearchResultHotkey({
    enabled: debouncedSearchValue === searchValue,
    resultsContainer: suggestionsContainerRef,
    target: inputRef,
  })

  return (
    <Popover.Root
      onOpenChange={(open, { reason, cancel }) => {
        // Prevent closing the popover when the trigger is pressed
        if (reason === 'trigger-press' && !open) {
          cancel()
          return
        }

        if (reason === 'escape-key' && !open) {
          inputRef.current?.blur()
        }

        setIsOpen(open)
      }}
      open={isOpen}
    >
      <Popover.Trigger
        nativeButton={false}
        render={(props) => (
          <SearchInput
            isLoading={debouncedSearchValue !== searchValue}
            onFocus={() => setIsOpen(true)}
            ref={inputRef}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            wrapperProps={props}
          />
        )}
      />
      <Popover.Portal>
        <Popover.Positioner
          className="isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width)"
          positionMethod="fixed"
          sideOffset={4}
        >
          <Popover.Popup
            className="slide-in-from-top-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 w-(--anchor-width) origin-(--transform-origin) rounded bg-white transition-all duration-100 data-closed:animate-out data-open:animate-in"
            initialFocus={false}
          >
            <SearchSuggestions
              containerRef={suggestionsContainerRef}
              isLoading={debouncedSearchValue !== searchValue}
              onNavigate={resetSearch}
              searchValue={debouncedSearchValue}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
