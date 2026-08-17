import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useParams } from '@tanstack/react-router'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  type GetEnsOwnerReturnType,
  getEnsOwnerQueryOptions,
} from '@/features/profile/hooks/useEnsOwner'
import { getNameAvailabilityQueryOptions } from '@/features/profile/hooks/useNameAvailability'
import { V2RegistryInfo } from '@/features/registry/components/v2/RegistryInfo'
import { isRegistrable } from '@/utils/ens/tldHelpers'
import { NotFoundMessage } from '../../components/NotFoundMessage'

export const Route = createFileRoute('/$name/registry')({
  component: RouteComponent,
})

const RegistryInfo = ({
  name,
  ownerData,
}: {
  name: string
  ownerData: NonNullable<GetEnsOwnerReturnType>
}) => {
  // V1 and V2 names share the modern registry view (WEB-693); the tree's
  // empty-registry slot renders a Migrate CTA instead of the deploy form for
  // V1 names (see RegistryTreeItem).
  return <V2RegistryInfo name={name} ownerData={ownerData} />
}

function RouteComponent() {
  const { name } = useParams({ from: '/$name/registry' })

  const {
    isLoading,
    error,
    data: ownerData,
  } = useQuery(getEnsOwnerQueryOptions({ name }))

  const availabilityQuery = useQuery({
    ...getNameAvailabilityQueryOptions({ name }),
    enabled: isRegistrable(name),
  })

  if (error)
    return (
      <ErrorMessage
        title={error.cause.name}
        description={error.cause.message}
      />
    )
  if (isLoading || (availabilityQuery.isLoading && isRegistrable(name)))
    return <LoadingSpinner title="Loading owner info" />

  if (availabilityQuery.error)
    return (
      <ErrorMessage
        title="Error checking availability"
        description={
          availabilityQuery.error.cause?.message ||
          availabilityQuery.error.message
        }
      />
    )
  if (availabilityQuery.data?.isAvailable || !ownerData)
    return (
      <NotFoundMessage
        title="Name not registered"
        description={
          <>
            <strong>{name}</strong> is not registered, so there is no registry
            data to display.
          </>
        }
      />
    )

  return <RegistryInfo name={name} ownerData={ownerData} />
}
