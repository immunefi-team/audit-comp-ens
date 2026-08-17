import { match, P } from 'ts-pattern'
import {
  type Address,
  formatEther,
  formatGwei,
  type Hash,
  isAddress,
  zeroAddress,
} from 'viem'
import { useTransaction, useTransactionReceipt } from 'wagmi'
import {
  EntityBadge,
  entityBadgeLeadingPadScope,
} from '@/components/EntityBadge'
import { cn } from '@/lib/utils'
import { useBlockExplorerTxUrl } from '@/utils/blockExplorer/useBlockExplorerUrl'
import {
  getContractLabel,
  getEnsContractName,
} from '@/utils/ens/ensContractNames'
import { formatTimestamp } from '@/utils/formatting/formatTimestamp'
import type { TimelineIndexerEvent } from '../hooks/useNameHistoryTimeline'
import { resolveDecodedName } from '../summarize/decodeRawData'
import { AccountBadge, FullOnDesktop } from './AccountBadge'
import { ContractBadge } from './ContractBadge'
import { getDecodedParamEntries, getTimelineFieldType } from './eventFieldTypes'

const CONTRACT_PARAM_KEYS = new Set([
  'resolver',
  'registry',
  'subregistry',
  'implementer',
])

const DecodedValue = ({
  event,
  paramKey,
  value,
}: {
  event: TimelineIndexerEvent
  paramKey: string
  value: string
}) => {
  const address = isAddress(value, { strict: false }) ? value : undefined

  if (address && address !== zeroAddress) {
    const isRegistryParam =
      paramKey === 'registry' || paramKey === 'subregistry'
    if (getContractLabel(address) || CONTRACT_PARAM_KEYS.has(paramKey)) {
      return (
        <ContractBadge
          address={address}
          label={match(paramKey)
            .with('resolver', () => 'resolver')
            .with(
              P.union('registry', 'subregistry'),
              () => 'permissioned registry',
            )
            .otherwise(() => undefined)}
          isRegistry={isRegistryParam}
          format="wrap"
        />
      )
    }
    return <AccountBadge address={address} />
  }

  const name =
    paramKey === 'name' ? resolveDecodedName(value, event.name) : undefined
  if (name) {
    return (
      <EntityBadge variant="name" name={name} compact format="wrap">
        {name}
      </EntityBadge>
    )
  }

  return (
    <EntityBadge
      variant="default"
      type="content"
      copyValue={value}
      compact
      format="wrap"
    >
      {value}
    </EntityBadge>
  )
}

/** Tier-3 decoded-parameter table (Parameter / Type / Decoded) — inline, no card. */
export const DecodedParams = ({ event }: { event: TimelineIndexerEvent }) => {
  const entries = getDecodedParamEntries(event)

  if (entries.length === 0) {
    return (
      <p className="py-2 text-muted-foreground text-p">
        No decoded parameters for this event.
      </p>
    )
  }
  return (
    <div
      className={cn(
        'w-full min-w-0 [contain:inline-size]',
        entityBadgeLeadingPadScope,
      )}
    >
      <table className="w-full table-fixed border-separate border-spacing-y-2 text-p">
        <thead>
          <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide">
            <th className="w-28 py-1.5 pr-3 font-medium lg:w-34">Parameter</th>
            <th className="w-22 py-1.5 pr-3 font-medium lg:w-30">Type</th>
            <th className="py-1.5 font-medium">Decoded</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td className="py-1.5 pr-3 align-top">
                <EntityBadge variant="default">{key}</EntityBadge>
              </td>
              <td className="break-all py-1.5 pr-3 align-top font-mono text-muted-foreground">
                {getTimelineFieldType(event.type, key)}
              </td>
              <td className="max-w-0 py-1.5 align-top">
                <DecodedValue event={event} paramKey={key} value={value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const MetaRow = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <div className="flex items-center gap-3 py-1 text-muted-foreground">
    <span className="w-28 shrink-0 text-p lg:w-34">{label}</span>
    <div className={cn('min-w-0 flex-1', entityBadgeLeadingPadScope)}>
      {children}
    </div>
  </div>
)

const CopyableMetaValue = ({ value }: { value: string }) => (
  <EntityBadge variant="default" type="content" copyValue={value} compact>
    {value}
  </EntityBadge>
)

export const TransactionMeta = ({
  event,
  txHash,
}: {
  event: TimelineIndexerEvent
  txHash: Hash
}) => {
  const { data: tx, isLoading: isTxLoading } = useTransaction({ hash: txHash })
  const { data: receipt, isLoading: isReceiptLoading } = useTransactionReceipt({
    hash: txHash,
  })

  const pending = isTxLoading || isReceiptLoading ? '…' : '—'
  const toAddress = tx?.to ?? event.contractAddress ?? undefined

  const txUrl = useBlockExplorerTxUrl(txHash)

  const fromValue = tx?.from ? <AccountBadge address={tx.from} full /> : pending
  const toValue = match(toAddress)
    .with(P.nullish, () => pending)
    .with(
      P.when(
        (addr: Address) =>
          !!getEnsContractName(addr) ||
          event.contractAddress?.toLowerCase() === addr.toLowerCase(),
      ),
      (addr) => <ContractBadge address={addr} full />,
    )
    .otherwise((addr) => <AccountBadge address={addr} full />)

  const blockNumber = event.blockNumber.toString()
  const timestampLabel = formatTimestamp(BigInt(event.timestamp))
  const valueLabel = tx ? `${formatEther(tx.value)} ETH` : null
  const gasUsedLabel = receipt ? receipt.gasUsed.toString() : null
  const gasPriceLabel = receipt?.effectiveGasPrice
    ? `${formatGwei(receipt.effectiveGasPrice)} gwei`
    : null

  return (
    <div className="flex flex-col gap-y-2">
      <MetaRow label="Transaction">
        <EntityBadge
          variant="tx"
          copyValue={txHash}
          etherscanHref={txUrl}
          compact
        >
          <FullOnDesktop value={txHash} />
        </EntityBadge>
      </MetaRow>
      <MetaRow label="Block">
        <CopyableMetaValue value={blockNumber} />
      </MetaRow>
      <MetaRow label="Timestamp">
        {timestampLabel ? (
          <CopyableMetaValue value={`${timestampLabel} UTC`} />
        ) : (
          '—'
        )}
      </MetaRow>
      <MetaRow label="From">{fromValue}</MetaRow>
      <MetaRow label="To">{toValue}</MetaRow>
      {tx?.value !== 0n && (
        <MetaRow label="Value">
          {valueLabel ? <CopyableMetaValue value={valueLabel} /> : pending}
        </MetaRow>
      )}
      <MetaRow label="Gas used">
        {gasUsedLabel ? <CopyableMetaValue value={gasUsedLabel} /> : pending}
      </MetaRow>
      <MetaRow label="Gas price">
        {gasPriceLabel ? <CopyableMetaValue value={gasPriceLabel} /> : pending}
      </MetaRow>
    </div>
  )
}
