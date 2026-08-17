import { flexRender, type Row, type RowData } from '@tanstack/react-table'
import { ArrowRightFromLineIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export const SidebarTriggerRow = <T extends RowData = RowData>({
  row,
  setOpen,
  setClickedRow,
  open,
  showMoreButton = true,
}: {
  row: Row<T>
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  setClickedRow: React.Dispatch<React.SetStateAction<Row<T> | null>>
  open: boolean
  showMoreButton?: boolean
}) => {
  return (
    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className={cn('px-6', 'h-10 py-0')}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
      {showMoreButton && (
        <TableCell>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setClickedRow(row)
              setOpen(!open)
            }}
          >
            <ArrowRightFromLineIcon className="h-4 w-4" />
            <span className="text-sm font-medium">More</span>
          </Button>
        </TableCell>
      )}
    </TableRow>
  )
}
