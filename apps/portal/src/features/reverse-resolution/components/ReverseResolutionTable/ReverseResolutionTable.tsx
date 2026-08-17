import {
  flexRender,
  type Row,
  type Table as TableData,
} from '@tanstack/react-table'
import { useState } from 'react'
import { type Address, isAddressEqual } from 'viem'
import { useConnection } from 'wagmi'
import { SidebarTriggerRow } from '@/components/SidebarTriggerRow'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ReverseResolutionResult } from '../../hooks/useReverseResolution'
import { columns } from './columns'
import { ReverseResolutionSidebar } from './ReverseResolutionSidebar'

export const ReverseResolutionTable = ({
  table,
  address,
}: {
  table: TableData<ReverseResolutionResult>
  address: Address
}) => {
  // Track the selected row by its coin type (stable id) rather than holding a
  // Row object, which would go stale on refetch. See the forward-resolution
  // table for the same pattern.
  const [selectedCoinType, setSelectedCoinType] = useState<number | null>(null)

  const [open, setOpen] = useState(false)

  const { address: account } = useConnection()

  const clickedRow =
    selectedCoinType != null
      ? (table
          .getRowModel()
          .rows.find((r) => r.original.coinType === selectedCoinType) ?? null)
      : null

  const setClickedRow = (
    value: React.SetStateAction<Row<ReverseResolutionResult> | null>,
  ) => {
    setSelectedCoinType((prev) => {
      const prevRow =
        prev != null
          ? (table
              .getRowModel()
              .rows.find((r) => r.original.coinType === prev) ?? null)
          : null

      const newRow = typeof value === 'function' ? value(prevRow) : value

      return newRow?.original.coinType ?? null
    })
  }

  // Only show "More" button if the displayed address matches the connected account
  // Using isAddressEqual for case-insensitive comparison
  const canModify = account ? isAddressEqual(account, address) : false

  return (
    <ReverseResolutionSidebar
      row={clickedRow}
      address={address}
      {...{ open, setOpen }}
    >
      <Table className="relative">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead className="px-6 py-2" key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                )
              })}
              {canModify && (
                <TableHead className="px-6 py-2">Actions</TableHead>
              )}
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
                  showMoreButton={canModify}
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
    </ReverseResolutionSidebar>
  )
}
