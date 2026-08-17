import type { ReturnResolverEvent } from '@ensdomains/ensjs/subgraph'
import { useQuery } from '@tanstack/react-query'
import type { Hash } from 'viem'
import { EntityBadge } from '@/components/EntityBadge'
import { HistorySectionHeader } from '@/components/HistorySectionHeader'
import { InfoRow } from '@/components/InfoCard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { EventsDataTable } from '@/components/table/EventsDataTable'
import { useBlockTimestamps } from '@/features/profile/hooks/useBlockTimestamps'
import { useTransactionSenders } from '@/features/profile/hooks/useTransactionSenders'
import { getRecordHistoryQueryOptions } from '@/features/records/hooks/useRecordHistory'
import { fromCoinType } from '@/lib/utils'
import { groupEventsByTransactionId } from '@/utils/history/groupEventsByTransactionId'
import { CoinTypeLabel } from './CoinTypeLabel'
import type { ForwardName } from './ForwardNamesTable/columns'

interface AddressHistoryProps {
  history: ReturnResolverEvent[]
  name: string
}

const AddressHistory = ({ history, name }: AddressHistoryProps) => {
  const groupedData = groupEventsByTransactionId(history, 'resolver')

  const {
    data: timestampsData,
    isLoading: isLoadingTimestamps,
    error: timestampsError,
  } = useBlockTimestamps({
    blocks: history.map((item) => BigInt(item.blockNumber)),
  })

  const {
    data: sendersData,
    isLoading: isLoadingSenders,
    error: sendersError,
  } = useTransactionSenders({
    transactionHashes: groupedData.map((tx) => tx.transactionID as Hash),
  })

  if (isLoadingTimestamps && isLoadingSenders) {
    return <LoadingSpinner title="Loading transaction data..." />
  }
  if (isLoadingTimestamps) {
    return <LoadingSpinner title="Loading timestamps..." />
  }
  if (isLoadingSenders) {
    return <LoadingSpinner title="Loading transaction senders..." />
  }

  if (timestampsError) {
    return <div>Error loading timestamps: {timestampsError.cause?.message}</div>
  }
  if (sendersError) {
    return (
      <div>
        Error loading transaction senders: {sendersError.cause?.message}
      </div>
    )
  }

  if (!timestampsData || !sendersData) {
    return <div>No data available</div>
  }

  const dataWithTimestampsAndSenders = groupedData.map((tx) => ({
    ...tx,
    timestamp: timestampsData.get(BigInt(tx.blockNumber)),
    from: sendersData.get(tx.transactionID as Hash) || tx.from,
  }))

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <HistorySectionHeader />
      <EventsDataTable
        enableTransactionCount={false}
        enableFilters={false}
        enableSearch={false}
        name={name}
        data={dataWithTimestampsAndSenders}
      />
    </div>
  )
}

interface HistoryViewProps {
  name: string
}

const HistoryView = ({ name }: HistoryViewProps) => {
  const {
    data: history,
    isLoading,
    error,
  } = useQuery(
    getRecordHistoryQueryOptions({
      name,
      key: 'coins',
    }),
  )

  if (error) {
    return <div>History Error: {error.cause?.message || error.message}</div>
  }

  if (isLoading) return <LoadingSpinner title="Loading..." />

  if (!history) return <div>No history</div>

  return <AddressHistory history={history} name={name} />
}

export const ForwardNameDetails = ({ name, coinTypes }: ForwardName) => {
  const coins = coinTypes.map((coin) =>
    fromCoinType(BigInt(Number.parseInt(coin, 10))),
  )

  return (
    <div className="flex flex-col p-6 gap-6 [&_[data-slot=info-row]]:px-0">
      <h2 className="font-sans text-h2">{name}</h2>
      <div className="flex flex-col">
        <InfoRow label="Name">
          <EntityBadge variant="name" name={name} showAvatar>
            {name}
          </EntityBadge>
        </InfoRow>
        <InfoRow label="Records">
          <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1">
            {coins.map((coin) => (
              <CoinTypeLabel coin={coin} key={coin} />
            ))}
          </div>
        </InfoRow>
      </div>
      <HistoryView name={name} />
    </div>
  )
}
