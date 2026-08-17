import type { GetRecordsReturnType } from '@ensdomains/ensjs/public'
import { Link } from '@tanstack/react-router'
import {
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { EditNoteIcon } from '@/assets/icons'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { columns } from '@/features/records/components/RecordsTable/columns'
import { RecordsTable } from '@/features/records/components/RecordsTable/RecordsTable'
import { recordsToTableData } from '@/utils/records/recordsToTableData'
import type { ProtocolVersion } from '@/utils/types'

export const RecordList = ({
  name,
  records: rawRecords,
  canEdit = false,
  protocolVersion,
}: {
  name: string
  records: GetRecordsReturnType
  /** Whether the connected user can edit records */
  canEdit?: boolean
  /** The protocol version of the name */
  protocolVersion?: ProtocolVersion
}) => {
  const [sorting, setSorting] = useState<SortingState>([])
  const records = useMemo(() => recordsToTableData(rawRecords), [rawRecords])

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  })

  const recordCount = records.length

  const searchRecordsId = useId()

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex flex-row justify-between">
          <h1 className="text-h1">
            {recordCount > 0 ? `${recordCount} Records` : 'Records'}
          </h1>
          {canEdit && (
            <Button
              variant="default"
              className="flex items-center gap-2"
              asChild
            >
              <Link to="/$name/edit-records" params={{ name }}>
                <EditNoteIcon className="size-4" />
                Edit records
              </Link>
            </Button>
          )}
        </div>
        {recordCount > 0 && (
          <InputGroup className="bg-background rounded-sm">
            <InputGroupInput
              id={searchRecordsId}
              className="w-full"
              placeholder="Search records..."
              onChange={(event) => table.setGlobalFilter(event.target.value)}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
        )}
      </header>
      {recordCount > 0 ? (
        <div className="overflow-x-auto">
          <RecordsTable
            name={name}
            table={table}
            protocolVersion={protocolVersion}
          />
        </div>
      ) : (
        <NoResultsMessage
          title="No records set"
          description="Records store information linked to this name like addresses or profile information."
          className="mx-0"
        />
      )}
    </>
  )
}
