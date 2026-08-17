import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { useId, useState } from 'react'
import type { Address } from 'viem'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { columns } from '@/features/forward-resolution/components/ForwardNamesTable/columns'
import { ForwardNamesTable } from '@/features/forward-resolution/components/ForwardNamesTable/ForwardNamesTable'
import { getResolvedNamesForAddressQueryOptions } from '@/features/forward-resolution/components/hooks/useNamesForResolvedAddress'
import { extractErrorMessage } from '@/utils/errors/extractErrorMessage'
import { queryClient } from '@/utils/queryClient'

export const Route = createFileRoute('/addr/$addr/resolution')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  loader: ({ params }) =>
    queryClient.prefetchQuery(
      getResolvedNamesForAddressQueryOptions({
        address: params.addr as Address,
      }),
    ),
})

function RouteComponent() {
  const { addr: address } = Route.useParams() as { addr: Address }

  const [sorting, setSorting] = useState<SortingState>([])

  const { data, error, isLoading } = useQuery(
    getResolvedNamesForAddressQueryOptions({
      address,
    }),
  )

  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: 'includesString',
  })

  const searchNamesId = useId()

  if (isLoading) return <LoadingMessage />

  if (error) {
    return (
      <ErrorMessage
        title="Data unavailable"
        description={extractErrorMessage(error)}
      />
    )
  }

  if (!data || data.length === 0) {
    return (
      <>
        <header className="flex flex-col gap-4">
          <h1 className="text-h1">Address Resolution</h1>
        </header>
        <NoResultsMessage
          title="No names found"
          description="This address doesn't resolve to any ENS names yet."
          className="mx-0"
        />
      </>
    )
  }

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex flex-row justify-between">
          <h1 className="text-h1">Address Resolution</h1>
        </div>
        <InputGroup className="bg-background rounded-sm">
          <InputGroupInput
            id={searchNamesId}
            className="w-full"
            placeholder="Search..."
            onChange={(event) => table.setGlobalFilter(event.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
      </header>
      <ForwardNamesTable table={table} />
    </>
  )
}
