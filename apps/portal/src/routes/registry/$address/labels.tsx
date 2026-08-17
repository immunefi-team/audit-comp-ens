import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { Address } from 'viem'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { RegistryLabelsTable } from '@/features/registry/components/v2/RegistryLabelsTable'
import { getRegistryInfoQueryOptions } from '@/features/registry/hooks/useRegistry'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

export const Route = createFileRoute('/registry/$address/labels')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

function RouteComponent() {
  const { address: addressParam } = Route.useParams()
  const address = addressParam as Address
  const {
    data: registry,
    isLoading,
    error,
  } = useQuery(getRegistryInfoQueryOptions({ address }))

  if (isLoading) return <LoadingSpinner title="Loading registry" />

  if (error)
    return (
      <ErrorMessage
        title="Error loading registry"
        description={error.message}
      />
    )

  if (!registry)
    return (
      <NotFoundMessage
        title="Registry not found"
        description={
          <>
            <strong>{truncateAddress(address, 6, 4)}</strong> is not a known
            registry contract.
          </>
        }
      />
    )

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h2 md:text-h1">Labels</h1>
      <RegistryLabelsTable address={address} />
    </div>
  )
}
