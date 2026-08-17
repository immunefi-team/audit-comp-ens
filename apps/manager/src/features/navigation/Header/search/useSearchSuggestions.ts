import { useQuery } from '@tanstack/react-query'
import { useSelector } from '@xstate/store-react'
import { useMemo } from 'react'
import { profileReverseNameQuery } from '@/features/profile/service/profileReverseName'
import { buildSuggestions, parseSearchInput } from './searchSuggestions.utils'
import { searchHistoryStore } from './useSearchHistory'

export const useSearchSuggestions = (searchValue: string) => {
  const parsedInput = parseSearchInput(searchValue)
  const primaryNameQuery = useQuery({
    ...profileReverseNameQuery(
      parsedInput.type === 'address' ? parsedInput.value : undefined,
    ),
    enabled: parsedInput.type === 'address',
  })

  const history = useSelector(
    searchHistoryStore,
    (state) => state.context.history,
  )

  return useMemo(
    () =>
      buildSuggestions({
        parsedInput,
        primaryName: primaryNameQuery.data,
        history,
      }),
    [parsedInput, primaryNameQuery.data, history],
  )
}
