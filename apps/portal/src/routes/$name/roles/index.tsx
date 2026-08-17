import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { NameRegistryRolesOverviewTable } from '@/features/registry/components/v2/NameRegistryRolesOverviewTable'
import { NameResolverRolesOverviewTable } from '@/features/resolver/components/NameResolverRolesOverviewTable'
import { NameRolesOverviewTable } from '@/features/roles/components/NameRolesOverviewTable'

export const Route = createFileRoute('/$name/roles/')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

function RouteComponent() {
  const { name } = Route.useParams()
  const labels = name.split('.')
  const isSupportedName =
    name.endsWith('.eth') && (labels.length === 2 || labels.length === 3)

  const {
    data: owner,
    isLoading,
    error,
  } = useQuery({
    ...getEnsOwnerQueryOptions({ name }),
    enabled: isSupportedName,
  })

  if (!isSupportedName)
    return <ErrorMessage title="Only 2LD and 3LD .eth names are supported" />

  if (isLoading) return <LoadingMessage />

  if (error)
    return (
      <ErrorMessage
        compact
        description="Error fetching roles. Please refresh the page."
      />
    )

  if (owner?.protocolVersion !== 'ENSv2')
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-h2 md:text-h1">Roles</h1>
        <NoResultsMessage
          title="Roles unavailable"
          description="Role management is only available for ENSv2 names."
          className="mx-0"
        />
      </div>
    )

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h2 md:text-h1">Roles</h1>
      <NameRegistryRolesOverviewTable name={name} />
      <NameResolverRolesOverviewTable name={name} />
      <NameRolesOverviewTable
        name={name}
        registryAddress={owner.registryAddress}
      />
    </div>
  )
}
