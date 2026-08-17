import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { type Address, zeroAddress } from 'viem'
import { useWalletClient } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { Button } from '@/components/ui/button'
import { RegistryAddUserSheet } from '@/features/registry/components/v2/RegistryAddUserSheet'
import { RegistryRolesTable } from '@/features/registry/components/v2/RegistryRolesTable'
import { getHasRolesQueryOptions } from '@/features/registry/hooks/useHasRoles'
import { getRegistryInfoQueryOptions } from '@/features/registry/hooks/useRegistry'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

export const Route = createFileRoute('/registry/$address/roles')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

function RouteComponent() {
  const { address: addressParam } = Route.useParams()
  const address = addressParam as Address
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)

  const {
    data: registry,
    isLoading,
    error,
  } = useQuery(getRegistryInfoQueryOptions({ address }))

  const { data: walletClient } = useWalletClient()

  const callerAddress = walletClient?.account?.address

  const { data: isAdmin = false } = useQuery({
    ...getHasRolesQueryOptions({
      registryAddress: address,
      roles: ['ROLE_REGISTRAR_ADMIN'],
      account: callerAddress ?? zeroAddress,
    }),
    enabled: !!callerAddress,
  })

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
      <div className="flex items-center justify-between">
        <h1 className="text-h2 md:text-h1">Roles</h1>
        {isAdmin && (
          <Button
            variant="default"
            className="flex items-center gap-2"
            onClick={() => setIsAddUserOpen(true)}
          >
            <Plus className="size-4" />
            Add User
          </Button>
        )}
      </div>
      <RegistryRolesTable address={address} />
      {isAdmin && (
        <RegistryAddUserSheet
          open={isAddUserOpen}
          onOpenChange={setIsAddUserOpen}
          registryAddress={address}
        />
      )}
    </div>
  )
}
