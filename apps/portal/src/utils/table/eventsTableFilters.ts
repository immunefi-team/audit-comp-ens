import type {
  BaseEvent,
  EventsTableData,
} from '@/components/table/EventsDataTable/types'

/**
 * Groups event types by their category for use in filter dropdowns
 */
export const groupEventTypesByCategory = <TEvent extends BaseEvent>(
  data: EventsTableData<TEvent>[],
) => {
  const categories = new Map<string, Set<string>>()

  data.forEach((tx) => {
    tx.events.forEach((event) => {
      const category = event.category || 'other'
      if (!categories.has(category)) {
        categories.set(category, new Set())
      }
      categories.get(category)?.add(event.type)
    })
  })

  // Convert to the format expected by TableMultiSelectFilter
  return Array.from(categories.entries()).map(([category, types]) => ({
    title: `${category.charAt(0).toUpperCase() + category.slice(1)} events`,
    options: Array.from(types)
      .sort()
      .map((type) => ({
        label: type,
        value: type,
      })),
  }))
}

/**
 * Filters transactions by selected event types
 * Returns transactions that contain at least one event of the selected types
 */
export const filterByEventTypes = <TEvent extends BaseEvent>(
  data: EventsTableData<TEvent>[],
  selectedEventTypes: string[],
): EventsTableData<TEvent>[] => {
  if (selectedEventTypes.length === 0) return data

  return data.filter((tx) => {
    return tx.events.some((event) => selectedEventTypes.includes(event.type))
  })
}

/**
 * Filters transactions by date range
 * Transactions without timestamps are excluded
 * End of day is set to 23:59:59.999 for the 'to' date
 */
export const filterByDateRange = <TEvent extends BaseEvent>(
  data: EventsTableData<TEvent>[],
  dateRange: { from?: Date; to?: Date },
): EventsTableData<TEvent>[] => {
  if (!dateRange.from && !dateRange.to) return data

  return data.filter((tx) => {
    if (!tx.timestamp) return false

    const txDate = new Date(Number(tx.timestamp) * 1000)

    if (dateRange.from && txDate < dateRange.from) {
      return false
    }

    if (dateRange.to) {
      const toEndOfDay = new Date(dateRange.to)
      toEndOfDay.setHours(23, 59, 59, 999)
      if (txDate > toEndOfDay) {
        return false
      }
    }

    return true
  })
}

/**
 * Global search filter function for transactions
 * Searches in: transaction ID, event types, and sender address
 */
export const matchesSearchFilter = <TEvent extends BaseEvent>(
  tx: EventsTableData<TEvent>,
  searchValue: string,
): boolean => {
  const search = searchValue.toLowerCase()

  if (tx.transactionID.toLowerCase().includes(search)) return true

  if (tx.events.some((e) => e.type.toLowerCase().includes(search))) return true

  if (tx.from?.toLowerCase().includes(search)) return true

  return false
}
