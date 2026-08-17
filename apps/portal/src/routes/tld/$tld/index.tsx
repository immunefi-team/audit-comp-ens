import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ClockIcon } from 'lucide-react'
import { useMemo } from 'react'
import { zeroAddress } from 'viem'
import { CardsStackIcon, HubIcon, SupervisorAccountIcon } from '@/assets/icons'
import { EntityBadge } from '@/components/EntityBadge'
import { ErrorMessage } from '@/components/ErrorMessage'
import { HistorySectionHeader } from '@/components/HistorySectionHeader'
import { LoadingMessage } from '@/components/LoadingMessage'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { NotFoundMessage } from '@/components/NotFoundMessage'
import { NameSubgraphHistory } from '@/components/table/NameSubgraphHistory/NameSubgraphHistory'
import { Button } from '@/components/ui/button'
import { InfoRow } from '@/features/profile/components/InfoRow'
import { Owner } from '@/features/profile/components/Owner'
import { ProtocolRow } from '@/features/profile/components/ProtocolRow'
import { getDnsSecEnabledQueryOptions } from '@/features/profile/hooks/useDnsSecEnabled'
import { NAME_HISTORY_PAGE_SIZE } from '@/features/profile/hooks/useNameHistory'
import { getProfileQueryOptions } from '@/features/profile/hooks/useProfile'
import {
  type GetTldDataReturnType,
  getTldDataQueryOptions,
} from '@/features/profile/hooks/useTldData'
import { getV2NameHistoryQueryOptions } from '@/features/profile/hooks/useV2NameHistory'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import { transformV2EventsToSubgraphFormat } from '@/utils/history/transformV2Events'
import { queryClient } from '@/utils/queryClient'
import { recordsToTableData } from '@/utils/records/recordsToTableData'

export const Route = createFileRoute('/tld/$tld/')({
  component: TldOverview,
  notFoundComponent: () => <NotFoundMessage />,
  loader: ({ params }) =>
    params.tld !== 'eth'
      ? queryClient.prefetchQuery(
          getDnsSecEnabledQueryOptions({ tld: params.tld }),
        )
      : undefined,
})

/** Chevron-less counter card: the TLD subpages these would link to are not
    live yet, so the counters are display-only. */
const TldCounterCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
}) => (
  <div className="flex items-center gap-3 p-4 rounded-lg bg-background border border-secondary">
    <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
        <Icon className="size-4 shrink-0" />
        <span className="text-sm truncate">{label}</span>
      </div>
      <span className="text-xl font-medium text-foreground shrink-0">
        {value}
      </span>
    </div>
  </div>
)

const TldRecordCount = ({ tld }: { tld: string }) => {
  const tldDataQuery = useQuery(getTldDataQueryOptions({ tld }))
  const profileQuery = useQuery(
    getProfileQueryOptions({
      name: tld,
      protocolVersion: tldDataQuery.data?.protocolVersion,
    }),
  )

  const recordCount = useMemo(() => {
    if (profileQuery.data?.records)
      return recordsToTableData(profileQuery.data.records).length
    return 0
  }, [profileQuery.data?.records])

  return (
    <TldCounterCard
      icon={CardsStackIcon}
      label="Records set"
      value={recordCount}
    />
  )
}

const TldRegistryRow = ({
  registryAddress,
}: {
  registryAddress: GetTldDataReturnType['registryAddress']
}) => (
  <InfoRow icon={HubIcon} label="Registry">
    {registryAddress !== zeroAddress ? (
      <EntityBadge variant="contract" address={registryAddress}>
        {truncateAddress(registryAddress, 6, 4, '...')}
      </EntityBadge>
    ) : (
      <span className="text-sm text-muted-foreground">
        No registry deployed
      </span>
    )}
  </InfoRow>
)

const HistorySection = ({ tld }: { tld: string }) => {
  const v2HistoryQuery = useQuery(
    getV2NameHistoryQueryOptions({ name: tld, first: NAME_HISTORY_PAGE_SIZE }),
  )

  if (v2HistoryQuery.isLoading) {
    return <LoadingSpinner title="Loading history..." />
  }

  if (v2HistoryQuery.error) {
    return (
      <ErrorMessage
        compact
        description="Error fetching history. Please refresh the page."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <HistorySectionHeader
        action={
          <Button variant="ghost" size="sm" className="text-neutral-7" disabled>
            <ClockIcon className="size-4" />
            Full history
          </Button>
        }
      />
      <NameSubgraphHistory
        name={tld}
        v2Events={transformV2EventsToSubgraphFormat(v2HistoryQuery.data || [])}
        enableHeader={false}
      />
    </div>
  )
}

function TldOverview() {
  const { tld } = Route.useParams()
  const isEthTld = tld === 'eth'

  const dnsSecQuery = useQuery(
    getDnsSecEnabledQueryOptions({
      tld,
      enabled: !isEthTld,
    }),
  )
  const isTldValid = isEthTld || dnsSecQuery.data === true

  const tldDataQuery = useQuery({
    ...getTldDataQueryOptions({ tld }),
    enabled: isTldValid,
  })

  if (!isEthTld && dnsSecQuery.isLoading) return <LoadingMessage />

  if (dnsSecQuery.error) {
    return <ErrorMessage />
  }

  if (!isTldValid) {
    return (
      <NotFoundMessage
        title="TLD not found"
        description={
          <>
            The TLD <strong>{tld}</strong> does not have any data in ENS yet.
          </>
        }
      />
    )
  }

  if (tldDataQuery.isLoading) return <LoadingMessage />

  if (tldDataQuery.error) {
    return <ErrorMessage />
  }

  if (!tldDataQuery.data) {
    return (
      <NotFoundMessage
        title="TLD not found"
        description={
          <>
            The TLD <strong>{tld}</strong> does not have any data in ENS yet.
          </>
        }
      />
    )
  }

  const { owner, registryAddress, rootRegistryAddress } = tldDataQuery.data

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-h1">{tld}</h1>

      {/* Main section: metadata rows | counters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col flex-1">
          <Owner owner={owner ?? undefined} asRow />
          <InfoRow icon={SupervisorAccountIcon} label="Parent">
            <EntityBadge variant="contract" address={rootRegistryAddress}>
              [root]
            </EntityBadge>
          </InfoRow>
          <TldRegistryRow registryAddress={registryAddress} />
          <ProtocolRow protocolVersion="ENSv2" />
        </div>

        <div className="flex flex-col gap-3 shrink-0">
          <TldRecordCount tld={tld} />
        </div>
      </div>

      {/* History */}
      <HistorySection tld={tld} />
    </div>
  )
}
