import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, TriangleAlert } from 'lucide-react'
import { Fragment } from 'react'
import { match, P } from 'ts-pattern'
import { type Address, zeroAddress } from 'viem'
import { EntityBadge } from '@/components/EntityBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { GetEnsOwnerReturnType } from '@/features/profile/hooks/useEnsOwner'
import { useIsMobile } from '@/hooks/use-mobile'
import { useBlockExplorerTxUrl } from '@/utils/blockExplorer/useBlockExplorerUrl'
import { formatTimestampDate } from '@/utils/formatting/formatTimestamp'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import { getRegistryLabelCountQueryOptions } from '../../hooks/useRegistryLabelCount'
import { ConfigureRegistryForm } from './ConfigureRegistryForm'
import { MigrateRegistryPrompt } from './MigrateRegistryPrompt'

type RegistryTreeItemProps = {
  chainId: number
  ownerData: NonNullable<GetEnsOwnerReturnType>
  index: number
  registriesCount: number
  address: Address
  label: string
  name: string
}

export const RegistryTreeItem = ({
  chainId,
  ownerData,
  index,
  registriesCount,
  address,
  label,
  name,
}: RegistryTreeItemProps) => {
  const isMobile = useIsMobile()

  const isRoot = index === 0
  const isEthRegistry = index === 1
  const isLast = index === registriesCount - 1
  const isParent = !isRoot && !isLast

  const isDeployedRegistry = !isRoot && !isEthRegistry

  // registries are ordered `[name, ...ancestors, root]`, so this reversed item's
  // full name is the suffix of labels starting at its position.
  const levelName = name
    .split('.')
    .slice(registriesCount - index - 1)
    .join('.')

  const isRegistryConfigured = address !== zeroAddress

  const isLastWithRegistryConfigured = isLast && isRegistryConfigured
  const isLastWithoutRegistryConfigured = isLast && !isRegistryConfigured

  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useQuery({
    ...getRegistryLabelCountQueryOptions({ address }),
    enabled: isLastWithRegistryConfigured,
  })

  const creationTxUrl = useBlockExplorerTxUrl(
    summary?.creationTransactionHash ?? undefined,
    chainId,
  )

  return (
    <Fragment>
      <div
        className="flex flex-col md:gap-2 gap-0"
        style={{
          paddingLeft: `${50 * Math.max(index - 1, 0)}px`,
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-start md:gap-2 gap-0">
          <div className="flex flex-row items-center justify-start gap-2">
            {!isRoot ? (
              <>
                <RegistryTreePathIcon />
                <EntityBadge variant="name" name={levelName} showAvatar>
                  {label}
                </EntityBadge>
              </>
            ) : null}
          </div>

          {isRegistryConfigured ? (
            <Fragment>
              <EntityBadge
                label={match({ isRoot, isParent, isLast })
                  .with({ isRoot: true }, () => 'root registry')
                  .with({ isParent: true }, () => 'parent registry')
                  .with({ isLast: true }, () => 'permissioned registry')
                  .with(
                    { isRoot: false, isParent: false, isLast: false },
                    () => undefined,
                  )
                  .exhaustive()}
                variant="contract"
                className="font-normal"
                address={address}
                isRegistry={isDeployedRegistry}
                tld={isEthRegistry ? levelName : undefined}
              >
                {truncateAddress(address, 6, 4)}
              </EntityBadge>
              {!isLastWithRegistryConfigured ? (
                <div className="flex flex-row items-center justify-start gap-2 px-1 lg:px-0 pb-2.5 lg:pb-0">
                  <span className="text-sm text-muted-foreground font-mono">
                    Chain ID: {chainId}
                  </span>
                  <span className="text-sm text-muted-foreground font-mono">
                    {ownerData.protocolVersion}
                  </span>
                </div>
              ) : null}
            </Fragment>
          ) : null}
        </div>
        {isLastWithRegistryConfigured ? (
          <dl className="grid lg:grid-cols-2 pt-4 items-center max-w-sm pl-1 lg:pl-14 text-sm text-muted-foreground lg:-mt-2">
            <dt className="py-2 h-9">Chain ID:</dt>
            <dd className="flex items-center h-9">{chainId}</dd>
            <dt className="py-2 h-9">Protocol Version:</dt>
            <dd className="flex items-center h-9">
              {ownerData.protocolVersion}
            </dd>
            <dt className="py-2 h-9">Created:</dt>
            <dd className="flex items-center h-9">
              {match({ isSummaryLoading, summaryError })
                .with({ isSummaryLoading: true }, () => (
                  <Skeleton className="h-5 w-32" />
                ))
                .with({ summaryError: P.not(null) }, () => <SummaryLoadError />)
                .otherwise(() =>
                  summary?.creationTransactionHash ? (
                    <EntityBadge
                      variant="tx"
                      className="font-normal"
                      label={
                        summary.createdAt
                          ? (formatTimestampDate(summary.createdAt) ??
                            undefined)
                          : undefined
                      }
                      copyValue={summary.creationTransactionHash}
                      etherscanHref={creationTxUrl}
                    >
                      {truncateAddress(summary.creationTransactionHash, 6, 4)}
                    </EntityBadge>
                  ) : summary?.createdAt ? (
                    <span>{formatTimestampDate(summary.createdAt) ?? '—'}</span>
                  ) : (
                    <span>—</span>
                  ),
                )}
            </dd>
            <dt className="py-2 h-9">Labels:</dt>
            <dd className="flex items-center gap-4 h-9">
              {match({ isSummaryLoading, summaryError })
                .with({ isSummaryLoading: true }, () => (
                  <Skeleton className="h-5 w-8" />
                ))
                .with({ summaryError: P.not(null) }, () => <SummaryLoadError />)
                .otherwise(() => (
                  <span className="text-foreground">
                    {summary?.labelCount ?? '—'}
                  </span>
                ))}
              <Button variant="outline" size="xs" asChild>
                <Link to="/registry/$address/labels" params={{ address }}>
                  View subnames <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </dd>
          </dl>
        ) : null}
        {isLastWithoutRegistryConfigured && !isMobile ? (
          <RegistryEmptyState name={name} ownerData={ownerData} />
        ) : null}
      </div>
      {isLastWithoutRegistryConfigured && isMobile ? (
        <RegistryEmptyState name={name} ownerData={ownerData} />
      ) : null}
    </Fragment>
  )
}

/**
 * What fills the unconfigured-registry slot: V2 names get the deploy form,
 * V1 names get the migrate prompt (or nothing when not migratable).
 */
const RegistryEmptyState = ({
  name,
  ownerData,
}: {
  name: string
  ownerData: NonNullable<GetEnsOwnerReturnType>
}) =>
  ownerData.protocolVersion === 'ENSv1' ? (
    <MigrateRegistryPrompt name={name} />
  ) : (
    <ConfigureRegistryForm name={name} />
  )

const SummaryLoadError = () => (
  <span className="inline-flex items-center gap-1 text-destructive">
    <TriangleAlert className="size-3.5" />
    Failed to load
  </span>
)

const RegistryTreePathIcon = () => {
  return (
    <svg
      width="45"
      height="52"
      viewBox="0 0 45 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 lg:ml-0 -ml-4"
    >
      <title>Registry tree path</title>
      <path
        d="M22 2V1H20V2H21H22ZM44.7071 28.7071C45.0976 28.3166 45.0976 27.6834 44.7071 27.2929L38.3431 20.9289C37.9526 20.5384 37.3195 20.5384 36.9289 20.9289C36.5384 21.3195 36.5384 21.9526 36.9289 22.3431L42.5858 28L36.9289 33.6569C36.5384 34.0474 36.5384 34.6805 36.9289 35.0711C37.3195 35.4616 37.9526 35.4616 38.3431 35.0711L44.7071 28.7071ZM21 2H20V24H21H22V2H21ZM25 28V29H44V28V27H25V28ZM21 24H20C20 26.7614 22.2386 29 25 29V28V27C23.3431 27 22 25.6569 22 24H21Z"
        fill="#C7C6C4"
      />
    </svg>
  )
}
