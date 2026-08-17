import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'
import type { Address } from 'viem'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { Button } from '@/components/ui/button'
import { useNameResolverAddress } from '@/features/records/hooks/useNameResolverAddress'
import { ResolverRolesTable } from '@/features/resolver/components/ResolverRolesTable'
import { getResolverOverviewQueryOptions } from '@/features/resolver/hooks/useResolverOverview'

/**
 * Read-only resolver roles for a name's resolver, for embedding on a name page.
 * Management happens on the resolver page itself, so the slider is disabled here.
 */
export const NameResolverRolesOverviewTable = ({ name }: { name: string }) => {
  const {
    data: resolverAddress,
    isLoading,
    error,
  } = useNameResolverAddress({ name })

  if (isLoading) return <LoadingMessage />

  if (error)
    return (
      <ErrorMessage
        compact
        description="Error fetching the resolver address. Please refresh the page."
      />
    )

  if (!resolverAddress)
    return (
      <NoResultsMessage
        className="mx-0"
        title="No resolver set"
        description={`${name} doesn't have a resolver, so there are no resolver roles to show.`}
      />
    )

  return <ResolverRolesOverview name={name} resolverAddress={resolverAddress} />
}

/**
 * Inner view rendered once the resolver address is known, so the overview query
 * receives a concrete `Address` (no cast) and can own its own loading/error UI.
 */
const ResolverRolesOverview = ({
  name,
  resolverAddress,
}: {
  name: string
  resolverAddress: Address
}) => {
  const {
    data: overview,
    isLoading,
    error,
  } = useQuery(getResolverOverviewQueryOptions({ address: resolverAddress }))

  if (isLoading) return <LoadingMessage />

  if (error)
    return (
      <ErrorMessage
        compact
        description="Error fetching resolver roles. Please refresh the page."
      />
    )

  const roles = overview?.roles ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-caps leading-none">{name} resolver roles</h3>
        <Button className="text-muted-foreground" variant="ghost" asChild>
          <Link
            params={{ address: resolverAddress }}
            to="/resolver/$address/roles"
          >
            <ArrowUpRight className="size-5" />
            View
          </Link>
        </Button>
      </div>
      {roles.length === 0 ? (
        <NoResultsMessage
          title="No role holders yet"
          description="Accounts with roles on this resolver will appear here."
          className="mx-0"
        />
      ) : (
        <ResolverRolesTable
          roles={roles}
          nodes={overview?.nodes ?? []}
          resolverAddress={resolverAddress}
          canManageRoles={false}
          disableEdit
        />
      )}
    </div>
  )
}
