import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertCircle, ArrowLeftIcon } from 'lucide-react'
import { zeroAddress } from 'viem'
import { useConnection } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { getHasRolesQueryOptions } from '@/features/registry/hooks/useHasRoles'
import { getNameRegistriesQueryOptions } from '@/features/registry/hooks/useNameRegistryDiscovery'
import { ChangeResolverForm } from '@/features/resolver/components/ChangeResolverForm'

export const Route = createFileRoute('/$name/change-resolver')({
  component: RouteComponent,
})

const PageLayout = ({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-4 p-4 w-full lg:max-w-2xl xl:max-w-5xl mx-auto">
    <Link to="/$name/resolver" params={{ name }}>
      <Button variant="ghost" className="flex items-center gap-2 -ml-2">
        <ArrowLeftIcon className="size-4" />
        Back
      </Button>
    </Link>
    <h1 className="text-h1">Change resolver</h1>
    {children}
  </div>
)

function RouteComponent() {
  const { name } = Route.useParams()
  const { address: connectedAddress } = useConnection()

  const ownerQuery = useQuery(getEnsOwnerQueryOptions({ name }))
  const registryQuery = useQuery({
    ...getNameRegistriesQueryOptions({ name }),
    enabled: ownerQuery.data?.protocolVersion === 'ENSv2',
  })

  const label = name.split('.')[0]
  // Use registries[1] to get the parent registry that manages this name
  const currentNameRegistry = registryQuery.data?.[1]

  const roleQuery = useQuery({
    ...getHasRolesQueryOptions({
      registryAddress: currentNameRegistry ?? zeroAddress,
      label,
      roles: ['ROLE_SET_RESOLVER'],
      account: connectedAddress ?? zeroAddress,
    }),
    enabled: !!connectedAddress && !!currentNameRegistry,
  })

  if (ownerQuery.isLoading || registryQuery.isLoading) {
    return <LoadingSpinner title="Loading registry information" />
  }

  if (ownerQuery.data?.protocolVersion === 'ENSv1') {
    return (
      <PageLayout name={name}>
        <Alert className="max-w-full">
          <AlertCircle />
          <AlertTitle>Not Available for V1 Names</AlertTitle>
          <AlertDescription className="break-all whitespace-normal max-w-full overflow-wrap-anywhere">
            V1 names (like {name}) use a different resolver management system.
            Please use the V1 ENS interface to change the resolver.
          </AlertDescription>
        </Alert>
      </PageLayout>
    )
  }

  if (registryQuery.error || !registryQuery.data || !currentNameRegistry) {
    return (
      <PageLayout name={name}>
        <Alert variant="destructive" className="max-w-full">
          <AlertCircle />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Could not find registry for this name.
          </AlertDescription>
        </Alert>
      </PageLayout>
    )
  }

  if (!connectedAddress) {
    return (
      <PageLayout name={name}>
        <ErrorMessage
          title="Wallet Not Connected"
          description="Please connect your wallet to change the resolver."
        />
      </PageLayout>
    )
  }

  if (roleQuery.isLoading) {
    return <LoadingSpinner title="Checking permissions..." />
  }

  if (!roleQuery.data) {
    return (
      <PageLayout name={name}>
        <ErrorMessage
          title="Permission Denied"
          description={
            <>
              You don't have the required{' '}
              <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">
                ROLE_SET_RESOLVER
              </code>{' '}
              permission to change the resolver for <strong>{name}</strong>.
              Please contact the registry administrator to request access.
            </>
          }
        />
      </PageLayout>
    )
  }

  return (
    <ChangeResolverForm name={name} registryAddress={currentNameRegistry} />
  )
}
