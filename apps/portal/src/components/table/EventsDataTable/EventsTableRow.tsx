import { flexRender, type Row } from '@tanstack/react-table'
import type { Address } from 'viem'
import { AddressDisplay } from '@/components/table/EventsDataTable/AddressDisplay'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { extractFromAddress } from '@/utils/events/extractFromAddress'
import type { BaseEvent, EventsTableData } from './types'

export const EventsTableRow = <TEvent extends BaseEvent = BaseEvent>({
  row,
}: {
  row: Row<EventsTableData<TEvent>>
}) => {
  return (
    <>
      <TableRow>
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id} className={cn('px-6', 'h-10 py-1')}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
      {row.getIsExpanded() &&
        row.original.events.map((event, index) => {
          // First try to extract address from event details (for V1 events with owner/registrant/newOwner)
          // Fall back to the transaction's from address (for V2 events)
          const eventDetails = event.details as Record<string, unknown>
          const eventAddress = extractFromAddress(eventDetails)
          const fromAddress = eventAddress ?? row.original.from

          const cellClassName = cn('px-6', 'h-10 py-1')
          const totalColumns = row.getVisibleCells().length
          const trailingColSpan = totalColumns - 4 // 2 leading + 1 event type + 1 address

          return (
            <TableRow
              // biome-ignore lint/suspicious/noArrayIndexKey: multiple events can share an id within one transaction, so transactionID-event.id is not guaranteed unique; the index disambiguates same-id siblings
              key={`${row.original.transactionID}-${event.id}-${index}`}
            >
              <TableCell colSpan={2} className={cellClassName} />

              {/* Transaction column - show event type */}
              <TableCell className={cellClassName}>
                <span>{event.type}</span>
              </TableCell>

              <TableCell className={cellClassName}>
                {fromAddress ? (
                  <AddressDisplay address={fromAddress as Address} />
                ) : (
                  <span>-</span>
                )}
              </TableCell>

              {trailingColSpan > 0 && (
                <TableCell
                  colSpan={trailingColSpan}
                  className={cellClassName}
                />
              )}
            </TableRow>
          )
        })}
    </>
  )
}
