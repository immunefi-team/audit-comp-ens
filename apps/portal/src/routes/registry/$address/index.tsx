import { getChainContractAddress } from '@ensdomains/ensjs/chain'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ChevronRight,
  GitBranch,
  ShieldIcon,
  TriangleAlert,
} from 'lucide-react'
import { match, P } from 'ts-pattern'
import { type Address, isAddressEqual, zeroAddress } from 'viem'
import { useChainId } from 'wagmi'
import { EntityBadge } from '@/components/EntityBadge'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { Skeleton } from '@/components/ui/skeleton'
import { RegistryHistoryByAddress } from '@/features/registry/components/v2/RegistryHistory'
import { getRegistryInfoQueryOptions } from '@/features/registry/hooks/useRegistry'
import { getRegistryDeploymentQueryOptions } from '@/features/registry/hooks/useRegistryDeployment'
import { sepoliaWithEns } from '@/lib/wagmi'
import { useBlockExplorerTxUrl } from '@/utils/blockExplorer/useBlockExplorerUrl'
import { formatTimestampDate } from '@/utils/formatting/formatTimestamp'
import { truncateAddress } from '@/utils/formatting/truncateAddress'

export const Route = createFileRoute('/registry/$address/')({
  component: RouteComponent,
  notFoundComponent: () => <NotFoundMessage />,
})

const PROTOCOL = 'ENSv2'

const FACTORY_ADDRESS = getChainContractAddress({
  chain: sepoliaWithEns,
  contract: 'ensVerifiableFactory',
})

function RouteComponent() {
  const { address: addressParam } = Route.useParams()
  const address = addressParam as Address
  const chainId = useChainId()

  const {
    data: registry,
    isLoading,
    error,
  } = useQuery(getRegistryInfoQueryOptions({ address }))
  const {
    data: parent,
    isLoading: isLoadingParent,
    error: parentError,
  } = useQuery({
    ...getRegistryInfoQueryOptions({
      address: registry?.parentRegistry ?? zeroAddress,
    }),
    enabled:
      !!registry?.parentRegistry &&
      !isAddressEqual(registry.parentRegistry, zeroAddress),
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

  const deployedDate = registry.createdAt
    ? formatTimestampDate(registry.createdAt)
    : null

  const referencedByNames = registry.referencedBy
    .map((domain) => domain.name)
    .filter((name): name is string => !!name)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <h1 className="text-h1">Registry Contract</h1>
        <div className="flex lg:items-center flex-col lg:flex-row flex-wrap gap-4 text-sm text-muted-foreground font-mono">
          <EntityBadge variant="default" label="type" className="font-normal">
            PermissionedRegistry
          </EntityBadge>
          <div className="flex flex-row flex-wrap gap-4 text-sm text-muted-foreground font-mono">
            <span>Chain ID: {chainId}</span>
            <span>Protocol: {PROTOCOL}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-10 lg:gap-6 lg:flex-row lg:items-start">
        <dl className="flex-1 grid lg:grid-cols-[auto_1fr] items-center gap-x-8">
          <dt className="text-ui text-muted-foreground flex items-center h-10">
            Address
          </dt>
          <dd className="flex items-center h-10">
            <EntityBadge variant="contract" address={address}>
              {truncateAddress(address, 6, 4)}
            </EntityBadge>
          </dd>

          <dt className="text-ui text-muted-foreground flex items-center h-10">
            Deployed
          </dt>
          <dd className="flex items-center h-10">
            <DeployedBadge
              namehash={registry.namehash}
              createdBlock={registry.createdBlock}
              deployedDate={deployedDate}
            />
          </dd>

          <dt className="text-ui text-muted-foreground flex items-center h-10">
            Factory
          </dt>
          <dd className="flex items-center h-10">
            <EntityBadge
              variant="contract"
              label="registry factory"
              address={FACTORY_ADDRESS}
              className="font-normal"
            >
              {truncateAddress(FACTORY_ADDRESS, 6, 4)}
            </EntityBadge>
          </dd>

          <dt className="text-ui text-muted-foreground flex items-center h-10">
            Parent
          </dt>
          <dd className="flex items-center h-10">
            {match({
              isRoot: isAddressEqual(registry.parentRegistry, zeroAddress),
              isLoadingParent,
              parentError,
              parent,
            })
              .with({ isRoot: true }, () => (
                <span className="text-muted-foreground">—</span>
              ))
              .with({ isLoadingParent: true }, () => (
                <Skeleton className="h-5 w-32" />
              ))
              .with({ parentError: P.not(null) }, () => <FailedToLoad />)
              .with({ parent: { name: P.string.minLength(1) } }, (m) => (
                <EntityBadge variant="name" name={m.parent.name} showAvatar>
                  {m.parent.name}
                </EntityBadge>
              ))
              .otherwise(() => (
                <span className="text-muted-foreground">—</span>
              ))}
          </dd>

          <dt className="text-muted-foreground flex items-center min-h-9 self-start">
            Referenced by
          </dt>
          <dd className="flex flex-wrap items-center gap-x-2 min-h-9 self-start -mt-2">
            {referencedByNames.length > 0 ? (
              referencedByNames.map((name) => (
                <EntityBadge key={name} variant="name" name={name} showAvatar>
                  {name}
                </EntityBadge>
              ))
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </dl>

        <div className="flex flex-col gap-3 w-full lg:w-72">
          <RegistryNavCard
            icon={<GitBranch className="size-4" />}
            label="Labels"
            count={registry.labelCount}
            to="/registry/$address/labels"
            address={address}
          />
          <RegistryNavCard
            icon={<ShieldIcon className="size-4" />}
            label="Roles"
            count={registry.roleCount}
            to="/registry/$address/roles"
            address={address}
          />
        </div>
      </div>

      <RegistryHistoryByAddress address={address} name={registry.name} />
    </div>
  )
}

const RegistryNavCard = ({
  icon,
  label,
  count,
  to,
  address,
}: {
  icon: React.ReactNode
  label: string
  count: number
  to: '/registry/$address/labels' | '/registry/$address/roles'
  address: Address
}) => (
  <Link
    to={to}
    params={{ address }}
    className="group/nav no-underline flex border border-muted rounded-sm w-full"
  >
    <div className="flex flex-row w-full items-center justify-between gap-4 p-4 transition-colors rounded-sm group-hover/nav:bg-accent">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm font-normal text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-normal font-semi-mono">{count}</span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </div>
  </Link>
)

const FailedToLoad = () => (
  <span className="inline-flex items-center gap-1 text-destructive">
    <TriangleAlert className="size-3.5" />
    Failed to load
  </span>
)

const DeployedBadge = ({
  namehash,
  createdBlock,
  deployedDate,
}: {
  readonly namehash: string
  readonly createdBlock: number
  readonly deployedDate: string | null
}) => {
  const {
    data: deployment,
    isLoading,
    error,
  } = useQuery(getRegistryDeploymentQueryOptions({ namehash, createdBlock }))
  const deploymentTxHash = deployment?.transactionHash
  const deploymentTxUrl = useBlockExplorerTxUrl(deploymentTxHash)

  return match({ isLoading, error, deploymentTxHash })
    .with({ isLoading: true }, () => <Skeleton className="h-5 w-32" />)
    .with({ error: P.not(null) }, () => <FailedToLoad />)
    .with({ deploymentTxHash: P.string }, (m) => (
      <EntityBadge
        variant="tx"
        className="font-normal"
        label={deployedDate ?? undefined}
        copyValue={m.deploymentTxHash}
        etherscanHref={deploymentTxUrl}
      >
        {truncateAddress(m.deploymentTxHash, 6, 4)}
      </EntityBadge>
    ))
    .otherwise(() =>
      deployedDate ? <span>{deployedDate}</span> : <span>—</span>,
    )
}
