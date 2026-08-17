import { flexRender, type Table as TableData } from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EventsTableRow } from './EventsTableRow'
import { MobileHistoryCard } from './mobile/MobileHistoryCard'
import type { BaseEvent, EventsTableData } from './types'

export const EventsTable = <TEvent extends BaseEvent = BaseEvent>({
  table,
}: {
  table: TableData<EventsTableData<TEvent>>
}) => {
  return (
    <>
      {/* Mobile view - Card layout */}
      <div className="md:hidden">
        {table.getRowModel().rows?.length ? (
          table
            .getRowModel()
            .rows.map((row) => (
              <MobileHistoryCard<TEvent> key={row.id} row={row} table={table} />
            ))
        ) : (
          <div className="px-6 py-24 text-center">No history found.</div>
        )}
      </div>

      {/* Desktop view - Table layout */}
      <div className="hidden md:block">
        <Table className="relative">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table
                .getRowModel()
                .rows.map((row) => (
                  <EventsTableRow<TEvent> key={row.id} row={row} />
                ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="h-24 text-center"
                >
                  No history found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
