import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { isAddressEqual } from 'viem'
import { useConnection } from 'wagmi'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { NameSubgraphHistory } from '@/components/table/NameSubgraphHistory/NameSubgraphHistory'
import { Button } from '@/components/ui/button'
import { V1NameManagerRecord } from '@/features/ownership/components/V1NameManagerRecord'
import { ExpiryWithRegistrationData } from '@/features/profile/components/ExpiryWithRegistrationData'
import { GraceBanner } from '@/features/profile/components/GraceBanner'
import { Owner } from '@/features/profile/components/Owner'
import { ParentName } from '@/features/profile/components/ParentName'
import { getEnsOwnerQueryOptions } from '@/features/profile/hooks/useEnsOwner'
import { useGraceStatus } from '@/features/profile/hooks/useGraceStatus'
import { getNameAvailabilityQueryOptions } from '@/features/profile/hooks/useNameAvailability'
import { useCanExtend } from '@/features/renew/hooks/useCanExtend'
import { useCanTransferName } from '@/features/transfer/hooks/useCanTransferName'
import { is2LD, isRegistrable } from '@/utils/ens/tldHelpers'

export const Route = createFileRoute('/$name/ownership/')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

function RouteComponent() {
  const { name } = Route.useParams()
  const { address } = useConnection()

  const { data, isLoading, error } = useQuery(getEnsOwnerQueryOptions({ name }))

  const availabilityQuery = useQuery({
    ...getNameAvailabilityQueryOptions({ name }),
    enabled: isRegistrable(name),
  })

  const grace = useGraceStatus({
    name,
    protocolVersion: data?.protocolVersion,
  })

  const { canExtend: graceCanExtend } = useCanExtend({
    name,
    protocolVersion: data?.protocolVersion ?? 'ENSv2',
    enabled: grace.isInGrace,
  })

  const isConnectedOwner =
    !!address &&
    !!data &&
    data.protocolVersion === 'ENSv2' &&
    isAddressEqual(address, data.owner)

  // Owning the token isn't enough — the registry reverts the transfer unless the
  // owner also holds ROLE_CAN_TRANSFER_ADMIN. Gate the button on it so we never
  // route someone into a transfer that would revert after the detach steps land.
  const { canTransfer: hasTransferRole } = useCanTransferName({
    name,
    registryAddress: data?.registryAddress,
    account: data?.owner,
    enabled: isConnectedOwner,
  })

  if (error)
    return (
      <ErrorMessage
        title="Failed to fetch owner"
        description={error.cause.message}
      />
    )

  if (isLoading || (availabilityQuery.isLoading && isRegistrable(name)))
    return <LoadingMessage />

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

  if (availabilityQuery.data?.isAvailable || !data)
    return (
      <NotFoundMessage
        title="Name not registered"
        description={
          <>
            <strong>{name}</strong> is not registered, so there is no ownership
            data to display.
          </>
        }
      />
    )

  const isSubname = !is2LD(name)

  const canTransfer = isConnectedOwner && hasTransferRole && !isSubname

  return (
    <div className="flex flex-col gap-8">
      {grace.isInGrace && grace.graceEndDate && (
        <GraceBanner
          graceEndDate={grace.graceEndDate}
          canExtend={graceCanExtend}
        />
      )}
      <div className="flex flex-row items-center justify-between">
        <h1 className="text-h1">Ownership</h1>
        {canTransfer && (
          <Button asChild className="gap-2">
            <Link params={{ name }} to="/$name/ownership/transfer">
              Transfer
            </Link>
          </Button>
        )}
      </div>
      {/* Header list — same structure as the Overview/Resolver pages (WEB-649) */}
      <div className="flex flex-col">
        <ExpiryWithRegistrationData
          name={name}
          protocolVersion={data.protocolVersion}
        />
        <Owner
          asRow
          label={grace.isInGrace ? 'Previous owner' : 'Owner'}
          owner={data.owner}
        />
        {data.protocolVersion === 'ENSv1' && (
          <V1NameManagerRecord asRow name={name} />
        )}
        <ParentName asRow name={name} />
      </div>
      <NameSubgraphHistory category="domain" name={name} />
    </div>
  )
}
