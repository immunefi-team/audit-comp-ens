import type { Row } from '@tanstack/react-table'
import {
  type ColumnFiltersState,
  type ExpandedState,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { CollapseAllButton } from '@/components/table/CollapseAllButton'
import { EventsSidebar } from '@/components/table/EventsDataTable/EventsSidebar'
import { TableDateRangeFilter } from '@/components/table/TableDateRangeFilter'
import { TableMultiSelectFilter } from '@/components/table/TableMultiSelectFilter'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  filterByDateRange,
  filterByEventTypes,
  groupEventTypesByCategory,
  matchesSearchFilter,
} from '@/utils/table/eventsTableFilters'
import { createEventsColumns } from './createEventsColumns'
import { EventsTable } from './EventsTable'
import type { BaseEvent, EventsTableConfig, EventsTableData } from './types'

export const EventsDataTable = <TEvent extends BaseEvent = BaseEvent>({
  data,
  name,
  enableSidebar = true,
  enableFilters = true,
  enableSearch = true,
  enableTransactionCount = true,
  enableNetwork = true,
  defaultNetwork = { name: 'Sepolia', icon: '/icons/eth.svg' },
  onTransactionClick,
}: EventsTableConfig<TEvent>) => {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [clickedRow, setClickedRow] = useState<Row<
    EventsTableData<TEvent>
  > | null>(null)
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [globalFilter, setGlobalFilter] = useState('')

  // Group event types by category for filters
  const eventTypesByCategory = useMemo(
    () => groupEventTypesByCategory(data),
    [data],
  )

  const filteredData = useMemo(() => {
    let filtered = data
    filtered = filterByEventTypes(filtered, selectedEventTypes)
    filtered = filterByDateRange(filtered, dateRange)
    return filtered
  }, [data, selectedEventTypes, dateRange])

  const columns = useMemo(
    () =>
      createEventsColumns<TEvent>({
        enableSidebar,
        enableNetwork,
        defaultNetworkName: defaultNetwork.name,
        defaultNetworkIcon: defaultNetwork.icon,
      }),
    [enableSidebar, enableNetwork, defaultNetwork.name, defaultNetwork.icon],
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      expanded,
      globalFilter,
    },
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      return matchesSearchFilter(row.original, filterValue)
    },
    meta: {
      onMoreClick: (row: Row<EventsTableData<TEvent>>) => {
        setClickedRow(row)
        setSidebarOpen(true)
        if (onTransactionClick) {
          onTransactionClick(row.original)
        }
      },
    },
  })

  const eventCount = data.length
  const searchId = useId()

  const handleCollapseAll = () => {
    if (Object.keys(expanded).length > 0) {
      setExpanded({})
    } else {
      const allExpanded: ExpandedState = {}
      filteredData.forEach((_, index) => {
        allExpanded[index] = true
      })
      setExpanded(allExpanded)
    }
  }

  const isCollapsed = Object.keys(expanded).length === 0

  return (
    <>
      {enableTransactionCount || enableSearch || enableFilters ? (
        <header className="flex flex-col gap-4">
          {enableTransactionCount && (
            <div className="flex flex-row justify-between">
              <h1 className="text-h1">
                {eventCount} Transaction{eventCount !== 1 ? 's' : ''}
              </h1>
            </div>
          )}

          {enableSearch && (
            <InputGroup className="bg-background rounded-sm">
              <InputGroupInput
                id={searchId}
                className="w-full"
                placeholder="Search..."
                onChange={(event) => table.setGlobalFilter(event.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
          )}

          {enableFilters && (
            <div className="flex flex-row gap-2 flex-wrap">
              <CollapseAllButton
                onToggle={handleCollapseAll}
                isCollapsed={isCollapsed}
              />
              <TableDateRangeFilter
                label="Date"
                dateRange={dateRange}
                onChange={setDateRange}
              />
              {eventTypesByCategory.length > 0 && (
                <TableMultiSelectFilter
                  label="Event"
                  groups={eventTypesByCategory}
                  selectedValues={selectedEventTypes}
                  onChange={setSelectedEventTypes}
                />
              )}
            </div>
          )}
        </header>
      ) : null}

      {enableSidebar ? (
        <EventsSidebar
          transaction={
            (clickedRow?.original as EventsTableData | undefined) ?? null
          }
          name={name}
          open={sidebarOpen}
          setOpen={setSidebarOpen}
        >
          <EventsTable<TEvent> table={table} />
        </EventsSidebar>
      ) : (
        <EventsTable<TEvent> table={table} />
      )}
    </>
  )
}
