import { Button } from '@/components/ui/button'
import { CommandGroup, CommandItem } from '@/components/ui/command'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { NameAvatar } from '@/features/profile/components/NameAvatar'
import { cn } from '@/lib/utils'
import { ensureEthSuffix } from '@/utils/ens/ensureEthSuffix'
import type { ProtocolVersion } from '@/utils/types'
import type { Suggestion } from '../utils/buildSearchSuggestions'

const AVATAR_SIZE = '32px'

const RegisterLink = ({ name }: { name: string }) => (
  <Button asChild variant="outline" size="sm">
    <a
      href={`/register?name=${encodeURIComponent(ensureEthSuffix(name))}`}
      rel="noopener noreferrer"
      className="ml-auto shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      Register
    </a>
  </Button>
)

const isSubname = (name: string) => name.split('.').length > 2

const getSuggestionDescription = ({
  isAvailable,
  isName,
  ownerResolved,
  hasOwner,
  isPendingAvailability,
  nameValue,
  defaultDescription,
}: {
  isAvailable: boolean
  isName: boolean
  ownerResolved: boolean
  hasOwner: boolean
  isPendingAvailability: boolean
  nameValue: string
  defaultDescription: string
}): React.ReactNode => {
  if (isAvailable) return 'Available to register'
  if (isName && (!ownerResolved || isPendingAvailability)) {
    return <Skeleton className="h-3 w-24" />
  }
  if (isName && ownerResolved && !hasOwner && isSubname(nameValue)) {
    return 'Name not found'
  }
  return defaultDescription
}

const AvatarPlaceholder = ({ isLoading = false }: { isLoading?: boolean }) => (
  <div
    className={cn(
      'shrink-0 rounded-sm',
      isLoading
        ? 'bg-muted animate-pulse'
        : '[background:var(--avatar-placeholder-gradient)]',
    )}
    style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
  />
)

const SectionLegend = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <>
    <legend
      className={cn(
        'px-2 pt-2 pb-2 text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </legend>
    <div className="px-2 pb-2">
      <Separator />
    </div>
  </>
)

type SearchResultsListData = {
  suggestions: Suggestion[]
  ownerBySuggestionId: Map<
    string,
    | {
        owner: string
        registryAddress: string
        protocolVersion: ProtocolVersion
      }
    | null
    | undefined
  >
  availableNames: Suggestion[]
  pendingAvailabilityIds: Set<string>
  ownedNamesFiltered: { name: string }[]
}

export type SearchResultsListProps = SearchResultsListData & {
  onSelect: (value: string) => void
  variant: 'command' | 'listbox'
  listboxId?: string
  activeIndex?: number
}

export const SearchResultsList = ({
  suggestions,
  ownerBySuggestionId,
  availableNames,
  pendingAvailabilityIds,
  ownedNamesFiltered,
  onSelect,
  variant,
  listboxId = '',
  activeIndex = -1,
}: SearchResultsListProps) => {
  const hasSuggestions = suggestions.length > 0
  const hasOwned = ownedNamesFiltered.length > 0

  const availableNameIds = new Set(availableNames.map((s) => s.id))

  const rowContent = (
    avatar: React.ReactNode,
    label: string,
    description?: React.ReactNode,
  ) => (
    <>
      {avatar}
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="font-medium">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
    </>
  )

  const rowClassName = (isActive: boolean) =>
    cn(
      'w-full flex flex-row items-center gap-3 rounded-sm px-2 py-1.5 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      variant === 'listbox' &&
        (isActive
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent hover:text-accent-foreground'),
    )

  const suggestionsStartIdx = 0
  const ownedStartIdx = suggestions.length

  return (
    <>
      {hasSuggestions &&
        (variant === 'command' ? (
          <CommandGroup
            heading="Suggestions"
            className="**:[[cmdk-group-heading]]:sr-only"
          >
            <SectionLegend>Suggestions</SectionLegend>
            {suggestions.map((suggestion) => {
              const isName = suggestion.id.startsWith('name:')
              const ownerData = isName
                ? ownerBySuggestionId.get(suggestion.id)
                : undefined
              const ownerResolved = ownerData !== undefined
              const hasOwner = ownerData !== null && ownerData !== undefined
              const isAvailable = availableNameIds.has(suggestion.id)
              const nameNotFound =
                isName &&
                ownerResolved &&
                !hasOwner &&
                !isAvailable &&
                isSubname(suggestion.inputValue)
              const avatar = isName ? (
                hasOwner ? (
                  <NameAvatar
                    name={suggestion.inputValue}
                    width={AVATAR_SIZE}
                    height={AVATAR_SIZE}
                    rounded="rounded-sm"
                  />
                ) : (
                  <AvatarPlaceholder isLoading={!ownerResolved} />
                )
              ) : (
                <AvatarPlaceholder />
              )
              const description = getSuggestionDescription({
                isAvailable,
                isName,
                ownerResolved,
                hasOwner,
                isPendingAvailability: pendingAvailabilityIds.has(
                  suggestion.id,
                ),
                nameValue: suggestion.inputValue,
                defaultDescription: suggestion.description,
              })
              return (
                <CommandItem
                  key={suggestion.id}
                  value={suggestion.id}
                  onSelect={onSelect}
                  disabled={nameNotFound}
                  className="flex flex-row items-center gap-3 py-2"
                >
                  {rowContent(avatar, suggestion.label, description)}
                  {isAvailable && <RegisterLink name={suggestion.inputValue} />}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ) : (
          <fieldset className="border-0 p-0 m-0 min-w-0">
            <SectionLegend>Suggestions</SectionLegend>
            {suggestions.map((suggestion, i) => {
              const idx = suggestionsStartIdx + i
              const isName = suggestion.id.startsWith('name:')
              const ownerData = isName
                ? ownerBySuggestionId.get(suggestion.id)
                : undefined
              const ownerResolved = ownerData !== undefined
              const hasOwner = ownerData !== null && ownerData !== undefined
              const isAvailable = availableNameIds.has(suggestion.id)
              const nameNotFound =
                isName &&
                ownerResolved &&
                !hasOwner &&
                !isAvailable &&
                isSubname(suggestion.inputValue)
              const avatar = isName ? (
                hasOwner ? (
                  <NameAvatar
                    name={suggestion.inputValue}
                    width={AVATAR_SIZE}
                    height={AVATAR_SIZE}
                    rounded="rounded-sm"
                  />
                ) : (
                  <AvatarPlaceholder />
                )
              ) : (
                <AvatarPlaceholder />
              )
              const description = getSuggestionDescription({
                isAvailable,
                isName,
                ownerResolved,
                hasOwner,
                isPendingAvailability: pendingAvailabilityIds.has(
                  suggestion.id,
                ),
                nameValue: suggestion.inputValue,
                defaultDescription: suggestion.description,
              })
              return (
                <button
                  key={suggestion.id}
                  id={listboxId ? `${listboxId}-opt-${idx}` : undefined}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  disabled={nameNotFound}
                  className={cn(
                    rowClassName(idx === activeIndex),
                    nameNotFound && 'opacity-50 cursor-default',
                  )}
                  onClick={() => onSelect(suggestion.id)}
                >
                  {rowContent(avatar, suggestion.label, description)}
                  {isAvailable && <RegisterLink name={suggestion.inputValue} />}
                </button>
              )
            })}
          </fieldset>
        ))}

      {hasOwned &&
        (variant === 'command' ? (
          <CommandGroup
            heading="Names you own"
            className="**:[[cmdk-group-heading]]:sr-only"
          >
            <SectionLegend>Names you own</SectionLegend>
            {ownedNamesFiltered.map((d) => (
              <CommandItem
                key={`owned:${d.name}`}
                value={`owned:${d.name}`}
                onSelect={onSelect}
                className="flex flex-row items-center gap-3 py-2"
              >
                {rowContent(
                  <NameAvatar
                    name={d.name}
                    width={AVATAR_SIZE}
                    height={AVATAR_SIZE}
                    rounded="rounded-sm"
                  />,
                  d.name,
                  'View',
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <fieldset className="border-0 p-0 m-0 min-w-0">
            <SectionLegend>Names you own</SectionLegend>
            {ownedNamesFiltered.map((d, i) => {
              const idx = ownedStartIdx + i
              return (
                <button
                  key={`owned:${d.name}`}
                  id={listboxId ? `${listboxId}-opt-${idx}` : undefined}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={rowClassName(idx === activeIndex)}
                  onClick={() => onSelect(`owned:${d.name}`)}
                >
                  {rowContent(
                    <NameAvatar
                      name={d.name}
                      width={AVATAR_SIZE}
                      height={AVATAR_SIZE}
                      rounded="rounded-sm"
                    />,
                    d.name,
                    'View',
                  )}
                </button>
              )
            })}
          </fieldset>
        ))}
    </>
  )
}
