import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { Address } from 'viem'
import { useConnection } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { Button } from '@/components/ui/button'
import { getHasRolesQueryOptions } from '@/features/registry/hooks/useHasRoles'
import { ResolverAddUserSheet } from '@/features/resolver/components/ResolverAddUserSheet'
import { ResolverRolesTable } from '@/features/resolver/components/ResolverRolesTable'
import { getResolverOverviewQueryOptions } from '@/features/resolver/hooks/useResolverOverview'
import { queryClient } from '@/utils/queryClient'

export const Route = createFileRoute('/resolver/$address/roles/')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
  loader: ({ params }) => {
    return queryClient.prefetchQuery(
      getResolverOverviewQueryOptions({
        address: params.address as Address,
      }),
    )
  },
})

function RouteComponent() {
  const { address } = Route.useParams()
  const { address: accountAddress } = useConnection()
  const [addUserOpen, setAddUserOpen] = useState(false)

  const {
    data: resolver,
    isLoading,
    error,
  } = useQuery(getResolverOverviewQueryOptions({ address: address as Address }))

  const { data: hasRootRole } = useQuery({
    ...getHasRolesQueryOptions({
      resolverAddress: address as Address,
      roles: ['ROLE_SET_ADDR'],
      account: accountAddress as Address,
    }),
    enabled: !!accountAddress,
  })

  const canManageRoles = Boolean(hasRootRole)

  if (isLoading) return <LoadingMessage />
  if (error)
    return (
      <ErrorMessage
        compact
        description="Error fetching roles. Please refresh the page."
      />
    )

  const roles = resolver?.roles ?? []
  const nodes = resolver?.nodes ?? []

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 md:text-h1">Roles</h1>
        {accountAddress && canManageRoles && (
          <Button
            variant="default"
            className="flex items-center gap-2"
            onClick={() => setAddUserOpen(true)}
          >
            <Plus className="size-4" />
            Add user
          </Button>
        )}
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
          nodes={nodes}
          resolverAddress={address as Address}
          canManageRoles={canManageRoles}
        />
      )}
      <ResolverAddUserSheet
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        resolverAddress={address as Address}
        nodes={nodes}
      />
    </div>
  )
}
