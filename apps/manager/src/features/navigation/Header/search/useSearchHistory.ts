import { createStore } from '@xstate/store-react'
import type { Address } from 'viem'
import { persist } from '@/utils/xstate-store'

const SEARCH_HISTORY_STORAGE_KEY = '@manager-v4/search_history'
const MAX_HISTORY_ITEMS = 15

export type SearchHistoryItem =
  | {
      readonly kind: 'name'
      readonly value: string
      readonly timestamp: number
    }
  | {
      readonly kind: 'address'
      readonly value: Address
      readonly timestamp: number
    }

type SearchHistoryContext = {
  readonly history: readonly SearchHistoryItem[]
}

type SearchHistoryEvents = {
  readonly addToHistory: Pick<SearchHistoryItem, 'value' | 'kind'>
  readonly clearHistory: Record<string, never>
  readonly removeFromHistory: { readonly value: string }
}

export const searchHistoryStore = createStore<
  SearchHistoryContext,
  SearchHistoryEvents,
  never
>({
  context: {
    history: [],
  },
  on: {
    addToHistory(context, event) {
      if (!event.value.trim()) {
        return context
      }

      const trimmedValue = event.value.trim()
      const filtered = context.history.filter(
        (item) => item.value.toLowerCase() !== trimmedValue.toLowerCase(),
      )
      const newItem = {
        kind: event.kind,
        value: trimmedValue,
        timestamp: Date.now(),
      } as SearchHistoryItem

      return {
        ...context,
        history: [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS),
      }
    },
    clearHistory: (context) => ({
      ...context,
      history: [],
    }),
    removeFromHistory: (context, event) => ({
      ...context,
      history: context.history.filter(
        (item) => item.value.toLowerCase() !== event.value.toLowerCase(),
      ),
    }),
  },
}).with(
  persist({
    name: SEARCH_HISTORY_STORAGE_KEY,
  }),
)
