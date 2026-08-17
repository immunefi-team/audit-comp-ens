import type { Address } from 'viem'
import { isAddress } from 'viem'
import {
  getLabelLength,
  parseName,
} from '@/features/register-v2/utils/name-parser'
import type { SearchHistoryItem } from './useSearchHistory'

const ETH_TLD = 'eth'
const MIN_REGISTRABLE_LABEL_LENGTH = 3

const isSearchNameSupported = (name: string): boolean => {
  const trimmed = name.trim()
  if (!trimmed) return false

  if (trimmed.startsWith('.') || trimmed.endsWith('.')) return false

  const parsedName = parseName(trimmed)

  if (parsedName.isErr()) return false

  return (
    parsedName.value.tld === ETH_TLD &&
    getLabelLength(parsedName.value.label) >= MIN_REGISTRABLE_LABEL_LENGTH
  )
}

type NameSuggestion = {
  readonly type: 'name'
  readonly value: string
  readonly isRegistered?: boolean
  readonly isLoading?: boolean
  readonly isError?: boolean
  readonly isSupported?: boolean
}

type AddressSuggestion = {
  readonly type: 'address'
  readonly value: Address
}

type Separator = {
  readonly type: 'separator'
}

export type SuggestionItem = NameSuggestion | AddressSuggestion | Separator

export type ParsedInput =
  | { readonly type: 'name'; readonly value: string }
  | { readonly type: 'address'; readonly value: Address }
  | { readonly type: 'error' }

export const parseSearchInput = (input: string): ParsedInput => {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return { type: 'error' }

  if (isAddress(trimmed, { strict: false })) {
    return { type: 'address', value: trimmed }
  }

  const value = trimmed.endsWith('.eth') ? trimmed : `${trimmed}.eth`
  return { type: 'name', value }
}

type BuildSuggestionsParams = {
  readonly parsedInput: ParsedInput
  readonly primaryName?: string | null
  readonly history: readonly SearchHistoryItem[]
}

const MAX_SUGGESTIONS = 6

export const buildSuggestions = ({
  parsedInput,
  primaryName,
  history,
}: BuildSuggestionsParams): SuggestionItem[] => {
  const suggestions: SuggestionItem[] = []

  if (parsedInput.type === 'address') {
    suggestions.push({ type: 'address', value: parsedInput.value })
    if (primaryName) {
      suggestions.push(
        { type: 'name', value: primaryName },
        { type: 'separator' },
      )
    }
  }

  if (parsedInput.type === 'name') {
    suggestions.push({
      type: 'name',
      value: parsedInput.value,
      isSupported: isSearchNameSupported(parsedInput.value),
    })
  }

  if (parsedInput.type === 'error') {
    for (const item of history) {
      if (item.kind === 'name') {
        suggestions.push({
          type: 'name',
          value: item.value,
          isSupported: isSearchNameSupported(item.value),
        })
      } else {
        suggestions.push({ type: 'address', value: item.value })
      }
    }
  }

  return suggestions.slice(0, MAX_SUGGESTIONS)
}
