import { EntityBadge } from '@/components/EntityBadge'
import { useBlockExplorerTxUrl } from '@/utils/blockExplorer/useBlockExplorerUrl'
import { formatExpiryDate } from '@/utils/formatting/formatDateTime'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import { unixSecondsToPlainDateUtc } from '@/utils/temporal'
import { formatTimelineTime } from '../formatTimelineDate'
import type { TimelineIndexerEvent } from '../hooks/useNameHistoryTimeline'
import { AccountBadge } from './AccountBadge'
import { TransactionMeta } from './EventDetail'
import { ExpandableDetailRow } from './ExpandableDetailRow'

interface TransactionHeaderRowProps {
  readonly event: TimelineIndexerEvent
}

export const TransactionHeaderRow = ({ event }: TransactionHeaderRowProps) => {
  const txUrl = useBlockExplorerTxUrl(event.transactionHash)

  return (
    <ExpandableDetailRow
      left={
        <>
          <AccountBadge txHash={event.transactionHash} />
          <span className="text-muted-foreground text-p">
            initiated at {formatTimelineTime(event.timestamp)}
          </span>
        </>
      }
      right={
        <EntityBadge
          variant="tx"
          label={formatExpiryDate(unixSecondsToPlainDateUtc(event.timestamp))}
          copyValue={event.transactionHash}
          etherscanHref={txUrl}
          compact
        >
          {truncateAddress(event.transactionHash)}
        </EntityBadge>
      }
      disclosure={
        <TransactionMeta event={event} txHash={event.transactionHash} />
      }
    />
  )
}
