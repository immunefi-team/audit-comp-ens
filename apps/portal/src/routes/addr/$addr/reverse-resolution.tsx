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
import { InvalidNameMessage } from '@/components/InvalidNameMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { columns } from '@/features/reverse-resolution/components/ReverseResolutionTable/columns'
import { ReverseResolutionTable } from '@/features/reverse-resolution/components/ReverseResolutionTable/ReverseResolutionTable'
import { REVERSE_RESOLUTION_NETWORKS } from '@/features/reverse-resolution/config'
import { getReverseResolutionQueryOptions } from '@/features/reverse-resolution/hooks/useReverseResolution'
import { queryClient } from '@/utils/queryClient'

export const Route = createFileRoute('/addr/$addr/reverse-resolution')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  loader: ({ params }) =>
    queryClient.prefetchQuery(
      getReverseResolutionQueryOptions({
        address: params.addr as Address,
        networks: REVERSE_RESOLUTION_NETWORKS,
      }),
    ),
})

function RouteComponent() {
  const { addr: address } = Route.useParams() as { addr: Address }
  const [sorting, setSorting] = useState<SortingState>([])

  const { data, error, isLoading } = useQuery(
    getReverseResolutionQueryOptions({
      address,
      networks: REVERSE_RESOLUTION_NETWORKS,
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

  const searchId = useId()

  if (isLoading) return <LoadingMessage />
  if (error)
    return (
      <InvalidNameMessage
        title="Error loading reverse resolution"
        description={
          <>
            {error.cause?.message ||
              error.message ||
              'An error occurred while loading reverse resolution data.'}
            <br />
            You can search for a name or address, or{' '}
            <a
              href="https://support.ens.domains/en/"
              className="underline decoration-dotted"
            >
              visit our support
            </a>{' '}
            for further help.
          </>
        }
      />
    )

  // The hook emits one placeholder row per configured network even when no
  // reverse record exists anywhere, so emptiness means "no row has a name".
  const hasReverseRecords = data?.some((row) => row.name || row.defaultName)

  if (!data || !hasReverseRecords)
    return (
      <>
        <header className="flex flex-col gap-4">
          <h1 className="text-h1">Reverse resolution</h1>
        </header>
        <NoResultsMessage
          title="No reverse records yet"
          description="This address doesn't have a reverse record on any network. Records will appear here once one is set."
          className="mx-0"
        />
      </>
    )

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex flex-row justify-between">
          <h1 className="text-h1">Reverse resolution</h1>
        </div>
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
      </header>
      <ReverseResolutionTable table={table} address={address} />
    </>
  )
}
