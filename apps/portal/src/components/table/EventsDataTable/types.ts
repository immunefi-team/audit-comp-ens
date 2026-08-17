import type { Address } from 'viem'

export type BaseEventCategory =
  | 'domain'
  | 'registration'
  | 'resolver'
  | (string & {})

/**
 * Base event structure that all events must follow
 */
export type BaseEvent<
  TDetails = Record<string, unknown>,
  TCategory extends BaseEventCategory = BaseEventCategory,
> = {
  id: string
  type: string
  category: TCategory
  details: TDetails
}

/**
 * Network information for a transaction
 */
type NetworkInfo = {
  name: string
  icon?: string
  chainId?: number
}

/**
 * Transaction data structure containing multiple events
 */
export type EventsTableData<TEvent extends BaseEvent = BaseEvent> = {
  transactionID: string
  blockNumber: number
  timestamp?: bigint
  from: Address | null
  network?: NetworkInfo
  events: TEvent[]
}

/**
 * Configuration options for the EventsDataTable component
 */
export type EventsTableConfig<TEvent extends BaseEvent = BaseEvent> = {
  // Required props
  data: EventsTableData<TEvent>[]
  name: string

  // Optional feature flags
  enableSidebar?: boolean
  enableFilters?: boolean
  enableSearch?: boolean
  enableTransactionCount?: boolean
  enableNetwork?: boolean

  // Fallback network (used when transaction doesn't have network info)
  defaultNetwork?: NetworkInfo

  // Callbacks
  onTransactionClick?: (tx: EventsTableData<TEvent>) => void
}
