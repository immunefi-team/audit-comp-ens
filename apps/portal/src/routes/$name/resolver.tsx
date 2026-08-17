import { useQueries, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import type { GetEnsResolverErrorType } from '@wagmi/core'
import { ClockIcon } from 'lucide-react'
import { ExternalLink } from 'react-external-link'
import { type Address, isAddressEqual, namehash, zeroAddress } from 'viem'
import { sepolia } from 'viem/chains'
import { useConnection } from 'wagmi'
import { getEnsResolverQueryOptions } from 'wagmi/query'
import { EditNoteIcon } from '@/assets/icons'
import { EntityBadge } from '@/components/EntityBadge'
import { ErrorMessage } from '@/components/ErrorMessage'
import { HistorySectionHeader } from '@/components/HistorySectionHeader'
import { LoadingMessage } from '@/components/LoadingMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InfoRow } from '@/features/profile/components/InfoRow'
import {
  type GetEnsOwnerReturnType,
  getEnsOwnerQueryOptions,
} from '@/features/profile/hooks/useEnsOwner'
import { getNameAvailabilityQueryOptions } from '@/features/profile/hooks/useNameAvailability'
import { NAME_HISTORY_PAGE_SIZE } from '@/features/profile/hooks/useNameHistory'
import { getV2NameHistoryQueryOptions } from '@/features/profile/hooks/useV2NameHistory'
import { getHasRolesQueryOptions } from '@/features/registry/hooks/useHasRoles'
import { getIsPermissionedResolverQueryOptions } from '@/features/resolver/hooks/useIsPermissionedResolver'
import { getResolverOverviewQueryOptions } from '@/features/resolver/hooks/useResolverOverview'
import { getSupportsInterfacesQueryOptions } from '@/hooks/useSupportsInterfaces'
import {
  RESOLVER_FEATURES,
  RESOLVER_INTERFACE_IDS,
  type ResolverInterfaceName,
} from '@/lib/constants/resolverInterfaceIds'
import {
  officialPublicResolverAddress,
  universalResolverAddress,
} from '@/lib/constants/universalResolver'
import { wagmiConfig } from '@/lib/wagmi'
import { isRegistrable } from '@/utils/ens/tldHelpers'
import { extractErrorMessage } from '@/utils/errors/extractErrorMessage'
import { transformV2EventsToSubgraphFormat } from '@/utils/history/transformV2Events'
import { NameSubgraphHistory } from '../../components/table/NameSubgraphHistory/NameSubgraphHistory'

export const Route = createFileRoute('/$name/resolver')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

const sepoliaUrl = sepolia.blockExplorers.default.url

const interfaceNamesById = Object.entries(RESOLVER_INTERFACE_IDS).map(
  ([name, value]) => [value, name as ResolverInterfaceName] as const,
)

interface EditButtonsProps {
  address: Address
  name: string
  resolverAddress?: Address
  registryAddress: Address
}

const EditButtons = ({
  address,
  name,
  resolverAddress,
  registryAddress,
}: EditButtonsProps) => {
  const label = name.split('.')[0]
  const { data: hasSetResolverRole } = useQuery({
    ...getHasRolesQueryOptions({
      registryAddress,
      label,
      roles: ['ROLE_SET_RESOLVER'],
      account: address,
    }),
  })

  if (!hasSetResolverRole) return null
  if (!resolverAddress || resolverAddress === zeroAddress) return null

  return (
    <Button variant="default" className="flex items-center gap-2" asChild>
      <Link to="/$name/change-resolver" params={{ name }}>
        <EditNoteIcon className="size-4" />
        Change resolver
      </Link>
    </Button>
  )
}

const ResolverAddressValue = ({ address }: { address: Address }) => (
  <EntityBadge
    variant="contract"
    address={address}
    etherscanHref={`${sepoliaUrl}/address/${address}`}
    className="max-w-full truncate"
  >
    {address}
  </EntityBadge>
)

const FeatureLinks = ({ resolverAddress }: { resolverAddress: Address }) => {
  const { data, isLoading, error } = useQuery(
    getSupportsInterfacesQueryOptions({
      address: resolverAddress,
      interfaces: Object.values(RESOLVER_INTERFACE_IDS),
    }),
  )

  if (isLoading) return <LoadingSpinner title="Loading interfaces..." />
  if (error)
    return (
      <div className="text-sm text-destructive">{error.cause?.message}</div>
    )
  if (!data) return <div className="text-sm text-muted-foreground">No data</div>

  const features = data
    .flatMap((supported, index) => {
      if (!supported) return []
      const [, name] = interfaceNamesById[index] ?? []
      if (!name) return []
      const feature = RESOLVER_FEATURES[name]
      if (!feature) return []
      return [feature]
    })
    .filter((feature, index, list) => {
      return list.findIndex((item) => item.name === feature.name) === index
    })

  if (features.length === 0)
    return (
      <div className="text-sm text-muted-foreground">
        No interfaces detected
      </div>
    )

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-p text-foreground">
      {features.map((feature) => (
        <ExternalLink
          key={feature.name}
          href={feature.link}
          className="underline transition-colors hover:text-primary"
        >
          {feature.name}
        </ExternalLink>
      ))}
    </div>
  )
}

const ResolverInfoList = ({
  resolverAddress,
  name,
  type,
  docsHref,
}: {
  resolverAddress: Address
  name: string
  type: string
  /** Official-resolver docs link — renders the audited notice in the Type row. */
  docsHref?: string
}) => {
  const { data: resolver } = useQuery(
    getResolverOverviewQueryOptions({ address: resolverAddress }),
  )
  const isAliased = resolver?.aliases.some((a) => a.fromName === name) ?? false
  const nodeHash = namehash(name)

  return (
    <div className="flex flex-col">
      <InfoRow label="Type">
        {docsHref ? (
          <p className="text-p text-foreground">
            This is an instance of the official{' '}
            <ExternalLink href={docsHref} className="underline">
              {type}
            </ExternalLink>
            . It is audited and is considered secure.
          </p>
        ) : (
          <span className="text-ui text-foreground">{type}</span>
        )}
      </InfoRow>
      <InfoRow label="Contract">
        <ResolverAddressValue address={resolverAddress} />
      </InfoRow>
      <InfoRow label="Node">
        <div className="flex items-center gap-2">
          <EntityBadge variant="name" name={name} showAvatar>
            {name}
          </EntityBadge>
          {isAliased && <Badge variant="outline">Aliased</Badge>}
        </div>
      </InfoRow>
      <InfoRow label="Namehash">
        <span className="text-entity-base text-foreground break-all">
          {nodeHash}
        </span>
      </InfoRow>
      <InfoRow label="Interfaces">
        <div>
          <FeatureLinks resolverAddress={resolverAddress} />
        </div>
      </InfoRow>
    </div>
  )
}

const HistorySection = ({
  name,
  protocolVersion,
}: {
  name: string
  protocolVersion: NonNullable<GetEnsOwnerReturnType>['protocolVersion']
}) => {
  const v2HistoryQuery = useQuery({
    ...getV2NameHistoryQueryOptions({ name, first: NAME_HISTORY_PAGE_SIZE }),
    enabled: protocolVersion === 'ENSv2',
  })

  if (protocolVersion === 'ENSv2') {
    if (v2HistoryQuery.isLoading) {
      return <LoadingSpinner title="Loading history..." />
    }

    if (v2HistoryQuery.error) {
      return (
        <div className="text-sm text-destructive">
          {v2HistoryQuery.error.cause?.message || v2HistoryQuery.error.message}
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4">
        <HistorySectionHeader
          action={
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-7"
              asChild
            >
              <Link to="/$name/history" params={{ name }}>
                <ClockIcon className="size-4" />
                Full history
              </Link>
            </Button>
          }
        />
        <NameSubgraphHistory
          name={name}
          v2Events={transformV2EventsToSubgraphFormat(
            v2HistoryQuery.data || [],
          )}
          enableHeader={false}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <HistorySectionHeader
        action={
          <Button variant="ghost" size="sm" className="text-neutral-7" asChild>
            <Link to="/$name/history" params={{ name }}>
              <ClockIcon className="size-4" />
              Full history
            </Link>
          </Button>
        }
      />
      <NameSubgraphHistory name={name} enableHeader={false} />
    </div>
  )
}

interface ResolverViewProps {
  name: string
  ownerData: NonNullable<GetEnsOwnerReturnType>
  resolverAddress: Address
}

const ResolverView = ({
  name,
  ownerData,
  resolverAddress,
}: ResolverViewProps) => {
  const { address } = useConnection()
  const permissionedResolverQuery = useQuery(
    getIsPermissionedResolverQueryOptions({ resolverAddress }),
  )

  const isOfficialPublicResolver = isAddressEqual(
    resolverAddress,
    officialPublicResolverAddress,
  )

  if (permissionedResolverQuery.isLoading) {
    return <LoadingSpinner title="Loading resolver info..." />
  }

  if (permissionedResolverQuery.error) {
    return (
      <ErrorMessage
        title="Error loading resolver details"
        description={String(permissionedResolverQuery.error.cause ?? '')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-h1">Resolver</h1>
        {address ? (
          <EditButtons
            address={address}
            name={name}
            resolverAddress={resolverAddress}
            registryAddress={ownerData.registryAddress}
          />
        ) : null}
      </div>

      {permissionedResolverQuery.data ? (
        <ResolverInfoList
          name={name}
          resolverAddress={resolverAddress}
          type="ENS Permissioned Resolver"
          docsHref="https://github.com/ensdomains/contracts-v2/blob/main/contracts/src/resolver/PermissionedResolver.sol"
        />
      ) : isOfficialPublicResolver ? (
        <ResolverInfoList
          name={name}
          resolverAddress={resolverAddress}
          type="ENS Public Resolver"
          docsHref="https://docs.ens.domains/resolvers/public/"
        />
      ) : (
        <ResolverInfoList
          name={name}
          resolverAddress={resolverAddress}
          type="Custom Resolver"
        />
      )}

      <HistorySection name={name} protocolVersion={ownerData.protocolVersion} />
    </div>
  )
}

const SetResolverButton = ({
  account,
  registryAddress,
  name,
}: {
  account: Address
  registryAddress: Address
  name: string
}) => {
  const label = name.split('.')[0]
  const { data: hasSetResolverRole } = useQuery(
    getHasRolesQueryOptions({
      registryAddress,
      label,
      roles: ['ROLE_SET_RESOLVER'],
      account,
    }),
  )

  if (!hasSetResolverRole) return null

  return (
    <Button variant="default" className="flex items-center gap-2" asChild>
      <Link to="/$name/change-resolver" params={{ name }}>
        <EditNoteIcon className="size-4" />
        Set resolver
      </Link>
    </Button>
  )
}

const NoResolverSet = ({
  name,
  registryAddress,
}: {
  name: string
  registryAddress: Address
}) => {
  const { address: account } = useConnection()

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h1">Resolver</h1>
      <div className="flex items-center gap-4 rounded-sm bg-accent-fill/40 p-6">
        <p className="flex-1 text-base text-muted-foreground">
          This name does not have a resolver set.
        </p>
        {account && (
          <SetResolverButton
            name={name}
            account={account}
            registryAddress={registryAddress}
          />
        )}
      </div>
    </div>
  )
}

function RouteComponent() {
  const { name } = useParams({ from: '/$name/resolver' })

  const [ownerQuery, resolverQuery] = useQueries({
    queries: [
      getEnsOwnerQueryOptions({ name }),
      {
        ...getEnsResolverQueryOptions(wagmiConfig, {
          name,
          universalResolverAddress,
        }),
        // useQueries reads each query's error type off `throwOnError`, and
        // wagmi's factory returns query-core options, which have no such field
        // — so TError falls back to DefaultError and collides with the
        // factory's own `retry: RetryValue<GetEnsResolverErrorType>`. Naming
        // the error here is what restores the narrowed type the
        // ChainDoesNotSupportContract branch below reads. `false` is already
        // the default, so behaviour is unchanged.
        throwOnError: (_error: GetEnsResolverErrorType) => false,
      },
    ],
  })

  // Whether the name is registered is a chain-state question: the v2 registry
  // keeps returning the previous owner (latestOwner) after expiry, so use the
  // registrar's availability (true only past grace) instead of owner presence.
  const availabilityQuery = useQuery({
    ...getNameAvailabilityQueryOptions({ name }),
    enabled: isRegistrable(name),
  })

  if (ownerQuery.error) {
    return (
      <ErrorMessage
        title={ownerQuery.error.cause.name}
        description={ownerQuery.error.cause.message}
      />
    )
  }

  if (resolverQuery.error) {
    if (resolverQuery.error.name === 'ChainDoesNotSupportContract')
      return <ErrorMessage title="Chain does not have UniversalResolver" />
    return (
      <ErrorMessage
        title="Error loading resolver"
        description={extractErrorMessage(resolverQuery.error, '')}
      />
    )
  }

  if (
    ownerQuery.isLoading ||
    resolverQuery.isLoading ||
    (availabilityQuery.isLoading && isRegistrable(name))
  )
    return <LoadingMessage />

  if (availabilityQuery.error) {
    return (
      <ErrorMessage
        title="Error checking availability"
        description={
          availabilityQuery.error.cause?.message ||
          availabilityQuery.error.message
        }
      />
    )
  }

  if (availabilityQuery.data?.isAvailable || !ownerQuery.data)
    return (
      <NotFoundMessage
        title="Name not registered"
        description={
          <>
            <strong>{name}</strong> is not registered, so there is no resolver
            data to display.
          </>
        }
      />
    )

  const resolverAddress = resolverQuery.data

  if (resolverAddress) {
    if (resolverAddress === zeroAddress) {
      return (
        <NoResolverSet
          name={name}
          registryAddress={ownerQuery.data.registryAddress}
        />
      )
    }
    return (
      <ResolverView
        name={name}
        ownerData={ownerQuery.data}
        resolverAddress={resolverAddress}
      />
    )
  }

  return (
    <ErrorMessage
      title="Unable to load resolver"
      description="Could not find resolver address."
    />
  )
}
