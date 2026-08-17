import { AnimatePresence, motion } from 'motion/react'
import type { RefObject } from 'react'
import { SearchInput } from './SearchInput'
import { SearchSuggestions } from './SearchSuggestions'

type MobileSearchPanelProps = {
  readonly open: boolean
  readonly onClose: () => void
  readonly searchValue: string
  readonly isLoading: boolean
  readonly containerRef?: RefObject<HTMLDivElement | null>
}

export const MobileSearchPanel = ({
  open,
  onClose,
  searchValue,
  isLoading,
  containerRef,
}: MobileSearchPanelProps) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 top-[54px] z-10 bg-black/50"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full right-0 left-0 z-20 border-ens-gray-two border-t bg-white shadow-temp-card"
            exit={{ opacity: 0, y: -12 }}
            initial={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="max-h-[60vh] overflow-y-auto rounded-lg bg-white">
              <SearchSuggestions
                containerRef={containerRef}
                isLoading={isLoading}
                onNavigate={onClose}
                searchValue={searchValue}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

type MobileSearchInputProps = {
  readonly onClose: () => void
  readonly searchValue: string
  readonly setSearchValue: (value: string) => void
  readonly isLoading: boolean
  readonly inputRef?: RefObject<HTMLInputElement | null>
}

export const MobileSearchInput = ({
  onClose,
  searchValue,
  setSearchValue,
  isLoading,
  inputRef,
}: MobileSearchInputProps) => {
  return (
    <SearchInput
      alwaysShowClear
      autoFocus
      className="h-11 border-none bg-[#F7F7F7]"
      isLoading={isLoading}
      onClear={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose()
        }
      }}
      ref={inputRef}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
    />
  )
}
