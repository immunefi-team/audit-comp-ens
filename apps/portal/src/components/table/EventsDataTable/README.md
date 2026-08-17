# EventsDataTable - Reusable Events Table Component

A fully reusable, type-safe table component for displaying transaction events with filtering, search, and sidebar functionality.

## Architecture

```
EventsDataTable/
├── types.ts                      # Generic types (BaseEvent, EventsTableData, EventsTableConfig)
├── EventsDataTable.tsx           # Main component with state management & filters
├── EventsTable.tsx               # Table renderer
├── EventsTableRow.tsx            # Row component with expandable events
├── createEventsColumns.tsx       # Column factory function
└── index.ts                      # Public exports
```

## Usage

### Basic Example (ENS History)

```typescript
import { EventsDataTable } from '@/components/table/EventsDataTable'
import type { ENSEvent } from '@/utils/history/transformHistoryToEvents'

<EventsDataTable<ENSEvent>
  data={eventsData}              // Your transformed data
  name="example.eth"             // Context name
  enableSidebar={true}           // Show transaction details sidebar
  enableFilters={true}           // Show event/date filters
  enableSearch={true}            // Show search bar
  networkName="Sepolia"          // Network display name
  networkIcon="/icons/eth.svg"   // Network icon path
/>
```

### Custom Event Type

```typescript
type CustomEvent = BaseEvent<{
  customField1: string
  customField2: number
}>

const data: EventsTableData<CustomEvent>[] = [
  {
    transactionID: '0x123...',
    blockNumber: 12345,
    timestamp: BigInt(1234567890),
    from: '0xabc...' as Address,
    events: [
      {
        id: '12345-0',
        type: 'CustomEventType',
        category: 'custom',
        details: {
          customField1: 'value',
          customField2: 42,
        },
      },
    ],
  },
]

<EventsDataTable<CustomEvent>
  data={data}
  name="Custom Events"
  enableSidebar={false}
  enableFilters={false}
/>
```

## Features

### ✅ Included Features
- **Sortable columns**: Date, Transaction, From, Network
- **Expandable rows**: Show individual events within transactions
- **Search**: Global search across transaction ID, event types, and addresses
- **Filters**:
  - Date range picker (From/To dates)
  - Event type multi-select (grouped by category)
  - Collapse/Expand all
- **Sidebar**: Transaction details with event data
- **Type-safe**: Full TypeScript generics support
- **Configurable**: Enable/disable features via props

### 🎨 Customization Options
- `enableSidebar`: Show/hide transaction details sidebar
- `enableFilters`: Show/hide filter controls
- `enableSearch`: Show/hide search bar
- `networkName`: Custom network display name
- `networkIcon`: Custom network icon path
- `onTransactionClick`: Callback when transaction is selected

## Data Transformation

Transform your data to `EventsTableData` format:

```typescript
const eventsData: EventsTableData<YourEventType>[] = yourData.map(item => ({
  transactionID: item.txHash,
  blockNumber: item.block,
  timestamp: item.timestamp,
  from: item.fromAddress,
  events: item.events.map(e => ({
    id: e.id,
    type: e.eventType,
    category: e.category,
    details: e.data,
  })),
}))
```

## Column Structure

Default columns:
1. **Expander**: Shows event count and expands/collapses
2. **Date**: Formatted to user`s locale
3. **Transaction**: Shortened hash with copy functionality
4. **From**: ENS name or address with avatar
5. **Network**: Network icon + name
6. **More** (optional): Opens sidebar with transaction details

## Dependencies

- `@tanstack/react-table` - Table state management
- `lucide-react` - Icons
- ENS components: `AddressDisplay`, `EventsSidebar`
- Table components: `TableDateRangeFilter`, `TableMultiSelectFilter`, `CollapseAllButton`

## Migration from HistoryList

The old `HistoryList` component has been replaced with this generic implementation:

**Before:**
```typescript
<HistoryList name={name} history={ensHistory} />
```

**After:**
```typescript
const eventsData = transformHistoryToEvents(ensHistory)
<EventsDataTable data={eventsData} name={name} />
```

## Type Definitions

```typescript
type BaseEvent<TDetails = Record<string, unknown>> = {
  id: string
  type: string
  category: string
  details: TDetails
}

type EventsTableData<TEvent extends BaseEvent = BaseEvent> = {
  transactionID: string
  blockNumber: number
  timestamp?: bigint
  from: Address | null
  events: TEvent[]
}
```

