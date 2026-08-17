import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { type Address, isAddress, zeroAddress } from 'viem'
import { useConnection } from 'wagmi'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { getNameAvailabilityQueryOptions } from '@/features/profile/hooks/useNameAvailability'
import { useIsMobile } from '@/hooks/use-mobile'
import { getSupportsInterfacesQueryOptions } from '@/hooks/useSupportsInterfaces'
import { RESOLVER_INTERFACE_IDS } from '@/lib/constants/resolverInterfaceIds'
import { isRegistrable } from '@/utils/ens/tldHelpers'
import type { ProtocolVersion } from '@/utils/types'
import type { Suggestion } from '../utils/buildSearchSuggestions'
import {
  buildSearchSuggestions,
  getSearchNotice,
} from '../utils/buildSearchSuggestions'
import {
  filterAndSortOwnedNames,
  mergeOwnedNames,
} from '../utils/ownedNamesUtils'
import {
  buildSearchResultItems,
  type SearchResultItem,
} from '../utils/searchResultsUtils'
import { useSuggestionTlds } from './useSuggestionTlds'
import { getV1NamesForAddressQueryOptions } from './useV1NamesForAddress'
import { getV2NamesForAddressQueryOptions } from './useV2NamesForAddress'

const MAX_OWNED_NAMES = 5

export type UseSearchResultsParams = {
  /** Trimmed search value */
  searchValue: string
  navigateToName: (name: string) => void
  navigateToAddress: (address: string) => void
  navigateToResolver: (address: string) => void
}

export type { SearchResultItem } from '../utils/searchResultsUtils'

export type UseSearchResultsReturn = {
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
  /** IDs of suggestions whose availability check is still in progress. */
  pendingAvailabilityIds: Set<string>
  ownedNamesFiltered: { name: string }[]
  /** Flat list in render order for keyboard nav (suggestions, then available, then owned). */
  allItems: SearchResultItem[]
  isTldsLoading: boolean
  hasAnySection: boolean
  /** Set when the input cannot be registered, e.g. a label under 3 characters. */
  readonly searchNotice: string | null
}

/**
 * Shared search results for both inline popover and Cmd+K modal.
 * Returns suggestions (with multi-TLD), owner lookup for avatars,
 * available-to-register names, and names the connected user owns.
 */
export const useSearchResults = ({
  searchValue,
  navigateToName,
  navigateToAddress,
  navigateToResolver,
}: UseSearchResultsParams): UseSearchResultsReturn => {
  const isMobile = useIsMobile()
  const { address: connectedAddress } = useConnection()
  const { validTlds, isLoading: isTldsLoading } = useSuggestionTlds(
    !!searchValue,
  )

  const searchedAddress = isAddress(searchValue, { strict: false })
    ? searchValue
    : undefined

  const { data: resolverInterfaces } = useQuery({
    ...getSupportsInterfacesQueryOptions({
      address: (searchedAddress ??
        '0x0000000000000000000000000000000000000000') as Address,
      interfaces: Object.values(RESOLVER_INTERFACE_IDS),
    }),
    enabled: !!searchedAddress,
  })

  const isResolver = resolverInterfaces?.some(Boolean) ?? false

  const suggestions = useMemo(
    () =>
      buildSearchSuggestions({
        value: searchValue,
        isMobile,
        navigateToAddress,
        navigateToName,
        navigateToResolver,
        isResolver,
        validTlds,
      }),
    [
      searchValue,
      isMobile,
      navigateToAddress,
      navigateToName,
      navigateToResolver,
      isResolver,
      validTlds,
    ],
  )

  const addressForOwned = connectedAddress ?? zeroAddress

  const [v1NamesQuery, v2NamesQuery] = useQueries({
    queries: [
      {
        ...getV1NamesForAddressQueryOptions({ address: addressForOwned }),
        enabled: Boolean(connectedAddress),
      },
      {
        ...getV2NamesForAddressQueryOptions({ address: addressForOwned }),
        enabled: Boolean(connectedAddress),
      },
    ],
  })

  const ownedNamesMerged = useMemo(
    () =>
      mergeOwnedNames(
        v1NamesQuery.data ?? [],
        (v2NamesQuery.data ?? []).flatMap((d) => [
          { name: d.name },
          ...(d.subdomains ?? []).map((s) => ({ name: s.name })),
        ]),
      ),
    [v1NamesQuery.data, v2NamesQuery.data],
  )

  const ownedNamesFiltered = useMemo(
    () =>
      filterAndSortOwnedNames(ownedNamesMerged, searchValue, {
        max: MAX_OWNED_NAMES,
      }),
    [searchValue, ownedNamesMerged],
  )

  /** Exclude suggestions for names the user already has in "Names you own" to avoid showing the same name twice. */
  const suggestionsFiltered = useMemo(() => {
    const ownedSet = new Set(
      ownedNamesFiltered.map((d) => d.name.trim().toLowerCase()),
    )
    return suggestions.filter(
      (s) => !ownedSet.has(s.inputValue.trim().toLowerCase()),
    )
  }, [suggestions, ownedNamesFiltered])

  const nameSuggestions = useMemo(
    () => suggestionsFiltered.filter((s) => s.id.startsWith('name:')),
    [suggestionsFiltered],
  )

  const ownerQueries = useQueries({
    queries: nameSuggestions.map((s) =>
      getEnsOwnerQueryOptions({ name: s.inputValue }),
    ),
  })

  const ownerBySuggestionId = useMemo(() => {
    const m = new Map<
      string,
      | {
          owner: string
          registryAddress: string
          protocolVersion: ProtocolVersion
        }
      | null
      | undefined
    >()
    nameSuggestions.forEach((s, i) => {
      const query = ownerQueries[i]
      m.set(s.id, query?.isError ? null : query?.data)
    })
    return m
  }, [nameSuggestions, ownerQueries])

  // Owner isn't a proxy for registered: an expired name keeps a registry entry
  // pointing at the NameWrapper, so it has an owner and is still available.
  const namesToCheckAvailability = useMemo(
    () => nameSuggestions.filter((s) => isRegistrable(s.inputValue)),
    [nameSuggestions],
  )

  const availabilityQueries = useQueries({
    queries: namesToCheckAvailability.map((s) =>
      getNameAvailabilityQueryOptions({ name: s.inputValue }),
    ),
  })

  const availableNames = useMemo(
    () =>
      namesToCheckAvailability.filter(
        (_, i) => availabilityQueries[i]?.data?.isAvailable === true,
      ),
    [namesToCheckAvailability, availabilityQueries],
  )

  const pendingAvailabilityIds = useMemo(() => {
    const set = new Set<string>()
    namesToCheckAvailability.forEach((s, i) => {
      if (availabilityQueries[i]?.data === undefined) {
        set.add(s.id)
      }
    })
    return set
  }, [namesToCheckAvailability, availabilityQueries])

  const hasSuggestions = suggestionsFiltered.length > 0
  const hasOwned = ownedNamesFiltered.length > 0
  const hasAnySection = hasSuggestions || hasOwned
  const searchNotice = hasAnySection ? null : getSearchNotice(searchValue)

  const allItems = useMemo(
    () =>
      buildSearchResultItems({
        suggestions: suggestionsFiltered,
        ownedNamesFiltered,
      }),
    [suggestionsFiltered, ownedNamesFiltered],
  )

  return {
    suggestions: suggestionsFiltered,
    ownerBySuggestionId,
    availableNames,
    pendingAvailabilityIds,
    ownedNamesFiltered,
    allItems,
    isTldsLoading,
    hasAnySection,
    searchNotice,
  }
}
