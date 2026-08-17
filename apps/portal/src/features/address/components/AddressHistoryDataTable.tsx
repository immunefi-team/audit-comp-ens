import { useMemo } from 'react'
import { ErrorMessage } from '@/components/ErrorMessage'
import { LoadingMessage } from '@/components/LoadingMessage'
import { NoResultsMessage } from '@/components/NoResultsMessage'
import { EventsDataTable } from '@/components/table/EventsDataTable'
import { useBlockTimestamps } from '@/features/profile/hooks/useBlockTimestamps'
import { useTransactionSenders } from '@/features/profile/hooks/useTransactionSenders'
import { enrichEventsWithMetadata } from '@/utils/history/enrichEventsWithMetadata'
import {
  extractBlocksNeedingTimestamps,
  extractTransactionHashes,
  transformAndMergeAddressHistory,
  type V1Events,
  type V2Event,
} from '@/utils/history/transformAddressHistory'
import type { ENSEvent } from '@/utils/history/transformHistoryToEvents'

type AddressHistoryData = {
  v1Events?: V1Events
  v2Events?: V2Event[]
}

export const AddressHistoryDataTable = ({
  history,
}: {
  history: AddressHistoryData
}) => {
  // Transform and merge V1 and V2 events into a single sorted array
  const eventsData = useMemo(
    () => transformAndMergeAddressHistory(history.v1Events, history.v2Events),
    [history.v1Events, history.v2Events],
  )

  // Extract blocks and transactions for metadata lookups
  const blocksNeedingTimestamps = useMemo(
    () => extractBlocksNeedingTimestamps(eventsData),
    [eventsData],
  )

  const transactionHashes = useMemo(
    () => extractTransactionHashes(eventsData),
    [eventsData],
  )

  const {
    data: timestampsData,
    isLoading: isLoadingTimestamps,
    error: timestampsError,
  } = useBlockTimestamps({
    blocks: blocksNeedingTimestamps,
  })

  // Fetch senders for all transactions
  const {
    data: sendersData,
    isLoading: isLoadingSenders,
    error: sendersError,
  } = useTransactionSenders({
    transactionHashes,
  })

  // Add timestamps and senders to the events data
  const eventsDataWithTimestampsAndSenders = useMemo(
    () => enrichEventsWithMetadata(eventsData, timestampsData, sendersData),
    [eventsData, timestampsData, sendersData],
  )

  if (isLoadingTimestamps && isLoadingSenders) {
    return <LoadingMessage title="Loading transaction data" />
  }
  if (isLoadingTimestamps) {
    return <LoadingMessage title="Loading timestamps" />
  }
  if (isLoadingSenders) {
    return <LoadingMessage title="Loading transaction senders" />
  }

  if (timestampsError) {
    return (
      <ErrorMessage
        compact
        description="Error fetching timestamps. Please refresh the page."
      />
    )
  }
  if (sendersError) {
    return (
      <ErrorMessage
        compact
        description="Error fetching transaction senders. Please refresh the page."
      />
    )
  }

  // Check if there's no history data
  if (eventsDataWithTimestampsAndSenders.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-h1">History</h1>
        <NoResultsMessage
          title="No history yet"
          description="This address doesn't have any recorded history. Activity will appear here once transactions are made."
          className="mx-0"
        />
      </div>
    )
  }

  return (
    <EventsDataTable<ENSEvent>
      data={eventsDataWithTimestampsAndSenders}
      name="" // Name will be extracted from individual transaction events in the sidebar
      enableSidebar={true}
      enableFilters={true}
      enableSearch={true}
      defaultNetwork={{
        name: 'Sepolia',
        icon: '/icons/eth.svg',
      }}
    />
  )
}
