import {
  flexRender,
  type Row,
  type Table as TableData,
} from '@tanstack/react-table'
import { useState } from 'react'
import { SidebarTriggerRow } from '@/components/SidebarTriggerRow'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ProtocolVersion } from '@/utils/types'
import { columns, type NameRecord } from './columns'
import { RecordSidebar } from './RecordSidebar'

export const RecordsTable = ({
  name,
  table,
  protocolVersion,
}: {
  name: string
  table: TableData<NameRecord>
  protocolVersion?: ProtocolVersion
}) => {
  const [clickedRow, setClickedRow] = useState<Row<NameRecord> | null>(null)

  const [open, setOpen] = useState(false)

  return (
    <RecordSidebar
      row={clickedRow}
      {...{ name, open, setOpen, protocolVersion }}
    >
      <Table className="relative">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
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
                <SidebarTriggerRow
                  key={row.id}
                  {...{ row, setOpen, setClickedRow, open }}
                />
              ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="px-6 py-24 text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </RecordSidebar>
  )
}
