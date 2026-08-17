import {
  flexRender,
  type Row,
  type Table as TableData,
} from '@tanstack/react-table'
import { type Dispatch, type SetStateAction, useState } from 'react'
import type { Address } from 'viem'
import { SidebarTriggerRow } from '@/components/SidebarTriggerRow'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AddressResolutionSidebar } from './AddressResolutionSidebar'
import { columns } from './columns'
import type { AddressResolutionRow } from './types'

export const AddressResolutionTable = ({
  table,
  name,
  resolverAddress,
}: {
  table: TableData<AddressResolutionRow>
  name: string
  resolverAddress: Address | undefined
}) => {
  const [open, setOpen] = useState(false)

  // Track the selected row by coin type (a stable id) rather than the Row
  // object, so the open sheet reflects refetched data instead of a stale
  // snapshot (mirrors ReverseResolutionTable).
  const [selectedCoinType, setSelectedCoinType] = useState<number | null>(null)
  const clickedRow =
    selectedCoinType != null
      ? (table
          .getRowModel()
          .rows.find((r) => r.original.coinType === selectedCoinType) ?? null)
      : null

  const setClickedRow: Dispatch<
    SetStateAction<Row<AddressResolutionRow> | null>
  > = (value) => {
    const next = typeof value === 'function' ? value(clickedRow) : value
    setSelectedCoinType(next?.original.coinType ?? null)
  }

  return (
    <AddressResolutionSidebar
      row={clickedRow}
      name={name}
      resolverAddress={resolverAddress}
      open={open}
      setOpen={setOpen}
    >
      <Table className="relative">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead className="px-6 py-2" key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
              <TableHead className="px-6 py-2" />
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
                colSpan={columns.length + 1}
                className="px-6 py-24 text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </AddressResolutionSidebar>
  )
}
