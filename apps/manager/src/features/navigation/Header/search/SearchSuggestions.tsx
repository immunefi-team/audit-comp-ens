import { Trans } from '@lingui/react/macro'
import { Loader2Icon } from 'lucide-react'
import type { RefObject } from 'react'
import { match } from 'ts-pattern'
import { buildNameAvatarUrl } from '@/features/profile/service/profileAvatar'
import { AddressSuggestionItem, NameSuggestionItem } from './SuggestionItem'
import { useSearchSuggestions } from './useSearchSuggestions'

type SearchSuggestionsProps = {
  readonly searchValue: string
  readonly isLoading: boolean
  readonly onNavigate?: () => void
  readonly containerRef?: RefObject<HTMLDivElement | null>
}

export const SearchSuggestions = ({
  searchValue,
  isLoading,
  onNavigate,
  containerRef,
}: SearchSuggestionsProps) => {
  const suggestions = useSearchSuggestions(searchValue)
  const isShowingHistory = !searchValue.trim()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-3 py-6">
        <Loader2Icon className="size-4 animate-spin text-slate-500" />
      </div>
    )
  }

  if (suggestions.length === 0) {
    if (isShowingHistory) {
      return (
        <div className="px-3 py-6 text-center text-slate-500 text-sm">
          <Trans>No recent searches</Trans>
        </div>
      )
    }
    return null
  }

  return (
    <div ref={containerRef}>
      {suggestions.map((suggestion, index) =>
        match(suggestion)
          .with({ type: 'name' }, (name) => (
            <NameSuggestionItem
              avatarUrl={buildNameAvatarUrl(name.value)}
              isError={name.isError}
              isLoading={name.isLoading}
              isRegistered={name.isRegistered}
              isSupported={name.isSupported}
              key={name.value}
              name={name.value}
              onNavigate={onNavigate}
            />
          ))
          .with({ type: 'address' }, (address) => (
            <AddressSuggestionItem
              address={address.value}
              key={address.value}
              onNavigate={onNavigate}
            />
          ))
          .with(
            { type: 'separator' },
            () =>
              index < suggestions.length - 1 && (
                <div
                  className="h-px w-full bg-ens-gray-two"
                  // biome-ignore lint/suspicious/noArrayIndexKey: Doesn't need to be unique between separators
                  key={`separator-${index}`}
                />
              ),
          )

          .exhaustive(),
      )}
    </div>
  )
}
