import type { Row, Table as TableData } from '@tanstack/react-table'
import { ArrowRightFromLineIcon, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BaseEvent, EventsTableData } from '../types'

interface MobileCardHeaderProps<TEvent extends BaseEvent> {
  row: Row<EventsTableData<TEvent>>
  table: TableData<EventsTableData<TEvent>>
  hasSidebar: boolean
}

export const MobileCardHeader = <TEvent extends BaseEvent = BaseEvent>({
  row,
  table,
  hasSidebar,
}: MobileCardHeaderProps<TEvent>) => {
  const eventCount = row.original.events.length

  return (
    <div className="flex justify-between items-start">
      {eventCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          aria-label={row.getIsExpanded() ? 'Collapse events' : 'Expand events'}
          onClick={(e) => {
            e.stopPropagation()
            row.toggleExpanded()
          }}
        >
          {row.getIsExpanded() ? <ChevronUp /> : <ChevronDown />}
          <span className="text-sm font-medium">{eventCount}</span>
        </Button>
      )}
      {hasSidebar && (
        <Button
          variant="default"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            const meta = table.options.meta as {
              onMoreClick?: (r: typeof row) => void
            }
            meta?.onMoreClick?.(row)
          }}
        >
          <ArrowRightFromLineIcon className="h-4 w-4" />
          <span className="text-sm font-medium">More</span>
        </Button>
      )}
    </div>
  )
}
