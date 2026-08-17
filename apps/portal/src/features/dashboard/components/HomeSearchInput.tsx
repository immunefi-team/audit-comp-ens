import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys'
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { CommandDialog, CommandInput } from '@/components/ui/command'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useDebouncedValue } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { useSearchResults } from '../hooks/useSearchResults'
import type { Suggestion } from '../utils/buildSearchSuggestions'
import { SearchModalContent } from './SearchModalContent'
import { SearchResultsList } from './SearchResultsList'

const SEARCH_DEBOUNCE_MS = 300

export const HomeSearchInput = ({
  className,
  iconOnly = false,
}: {
  className?: string
  iconOnly?: boolean
}) => {
  const listboxId = useId()
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalSearchValue, setModalSearchValue] = useState('')

  const trimmedSearch = useDebouncedValue(
    searchValue,
    SEARCH_DEBOUNCE_MS,
  ).trim()
  const trimmedModalSearch = useDebouncedValue(
    modalSearchValue,
    SEARCH_DEBOUNCE_MS,
  ).trim()

  const navigateToAddress = useCallback(
    (address: string) => {
      navigate({ to: '/addr/$addr', params: { addr: address } })
    },
    [navigate],
  )
  const navigateToName = useCallback(
    (name: string) => {
      navigate({ to: '/$name', params: { name } })
    },
    [navigate],
  )
  const navigateToResolver = useCallback(
    (address: string) => {
      navigate({ to: '/resolver/$address', params: { address } })
    },
    [navigate],
  )

  const navigateToRegister = useCallback(
    (name: string) => {
      const nameWithEth = name.includes('.') ? name : `${name}.eth`
      navigate({ to: '/register', search: { name: nameWithEth } })
    },
    [navigate],
  )

  const searchResults = useSearchResults({
    searchValue: trimmedSearch,
    navigateToName,
    navigateToAddress,
    navigateToResolver,
  })
  const {
    allItems,
    hasAnySection,
    searchNotice,
    suggestions,
    ownerBySuggestionId,
    availableNames,
    pendingAvailabilityIds,
    ownedNamesFiltered,
  } = searchResults

  useEffect(() => {
    setMenuOpen(Boolean(trimmedSearch))
  }, [trimmedSearch])
  useEffect(() => {
    setActiveIndex(allItems.length ? 0 : -1)
  }, [allItems.length])

  useHotkey('Mod+K', () => setModalOpen(true))

  useEffect(() => {
    if (!modalOpen) setModalSearchValue('')
  }, [modalOpen])

  const closePopover = useCallback(() => {
    setMenuOpen(false)
    triggerRef.current?.querySelector('input')?.blur()
  }, [])

  const handleSelectByValue = useCallback(
    (value: string) => {
      closePopover()
      if (value.startsWith('owned:')) {
        setSearchValue('')
        setModalOpen(false)
        setMenuOpen(false)
        navigateToName(value.slice('owned:'.length))
        return
      }
      const suggestion = suggestions.find((s) => s.id === value)
      if (suggestion) {
        setSearchValue('')
        const isAvailable = availableNames.some((a) => a.id === suggestion.id)
        if (isAvailable) {
          navigateToRegister(suggestion.inputValue)
        } else {
          suggestion.action()
        }
      }
    },
    [
      closePopover,
      suggestions,
      availableNames,
      navigateToName,
      navigateToRegister,
    ],
  )

  const handleModalSelectSuggestion = useCallback((suggestion: Suggestion) => {
    setModalOpen(false)
    suggestion.action()
  }, [])

  const handleModalSelectAvailableName = useCallback(
    (name: string) => {
      setModalOpen(false)
      navigateToRegister(name)
    },
    [navigateToRegister],
  )

  const handleSelectOwnedName = useCallback(
    (name: string) => {
      setModalOpen(false)
      setMenuOpen(false)
      navigateToName(name)
    },
    [navigateToName],
  )

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && allItems.length) {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % allItems.length)
      return
    }
    if (e.key === 'ArrowUp' && allItems.length) {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + allItems.length) % allItems.length)
      return
    }
    if (e.key === 'Enter') {
      const item = allItems[activeIndex >= 0 ? activeIndex : 0]
      if (item) {
        e.preventDefault()
        handleSelectByValue(item.value)
      }
      return
    }
    if (e.key === 'Escape') setMenuOpen(false)
  }

  if (iconOnly) {
    return (
      <>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          onClick={() => setModalOpen(true)}
        >
          <Search className="size-3.5" />
          <span className="sr-only">Search</span>
        </button>
        <CommandDialog
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Search"
          description="Search for ENS names or Ethereum addresses"
          showCloseButton={false}
          shouldFilter={false}
        >
          <CommandInput
            placeholder="Search..."
            value={modalSearchValue}
            onValueChange={setModalSearchValue}
          />
          <SearchModalContent
            searchValue={trimmedModalSearch}
            onSelectSuggestion={handleModalSelectSuggestion}
            onSelectOwnedName={handleSelectOwnedName}
            onSelectAvailableName={handleModalSelectAvailableName}
            navigateToName={navigateToName}
            navigateToAddress={navigateToAddress}
            navigateToResolver={navigateToResolver}
          />
        </CommandDialog>
      </>
    )
  }

  return (
    <>
      <Popover
        modal={false}
        open={menuOpen && (hasAnySection || !!searchNotice)}
        onOpenChange={(open) => !open && setMenuOpen(false)}
      >
        <PopoverTrigger asChild>
          <InputGroup
            ref={triggerRef}
            className={cn(
              'bg-sidebar-accent dark:bg-sidebar-accent rounded-sm max-w-3xl w-full',
              className,
            )}
            onClick={(e) => e.preventDefault()}
          >
            <InputGroupAddon align="inline-start">
              <Search className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              id={listboxId}
              role="combobox"
              aria-expanded={menuOpen && (hasAnySection || !!searchNotice)}
              aria-controls={`${listboxId}-listbox`}
              aria-activedescendant={
                activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
              }
              aria-autocomplete="list"
              className="w-full"
              placeholder="Search..."
              value={searchValue}
              onFocus={(e) => e.target.value.trim() && setMenuOpen(true)}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            <InputGroupAddon align="inline-end">
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-xs font-medium text-muted-foreground sm:flex">
                <span className="translate-y-px">
                  {formatForDisplay('Mod+K')}
                </span>
              </kbd>
            </InputGroupAddon>
          </InputGroup>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(
            'p-1 max-h-[min(60vh,400px)] overflow-y-auto max-w-[min(28rem,calc(100vw-1rem))]',
            // min-width beats max-width below the minimum, so the cap repeats inside it
            hasAnySection
              ? 'w-max min-w-[min(max(var(--radix-popover-trigger-width),20rem),calc(100vw-1rem))]'
              : 'w-(--radix-popover-trigger-width)',
          )}
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {searchNotice && (
            <div className="px-3 py-2 text-p text-message-warning-text">
              {searchNotice}
            </div>
          )}
          {hasAnySection && (
            <div
              role="listbox"
              id={`${listboxId}-listbox`}
              className="flex flex-col"
            >
              <SearchResultsList
                suggestions={suggestions}
                ownerBySuggestionId={ownerBySuggestionId}
                availableNames={availableNames}
                pendingAvailabilityIds={pendingAvailabilityIds}
                ownedNamesFiltered={ownedNamesFiltered}
                onSelect={handleSelectByValue}
                variant="listbox"
                listboxId={listboxId}
                activeIndex={activeIndex}
              />
            </div>
          )}
        </PopoverContent>
      </Popover>

      <CommandDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Search"
        description="Search for ENS names or Ethereum addresses"
        showCloseButton={false}
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Search..."
          value={modalSearchValue}
          onValueChange={setModalSearchValue}
        />
        <SearchModalContent
          searchValue={trimmedModalSearch}
          onSelectSuggestion={handleModalSelectSuggestion}
          onSelectOwnedName={handleSelectOwnedName}
          onSelectAvailableName={handleModalSelectAvailableName}
          navigateToName={navigateToName}
          navigateToAddress={navigateToAddress}
          navigateToResolver={navigateToResolver}
        />
      </CommandDialog>
    </>
  )
}
