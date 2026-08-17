import { match } from 'ts-pattern'
import { isAddress, zeroAddress } from 'viem'
import { EntityBadge } from '@/components/EntityBadge'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import type { TimelineIndexerEvent } from '../hooks/useNameHistoryTimeline'
import {
  decodeRoleChange,
  resolveDecodedName,
} from '../summarize/decodeRawData'
import { AccountBadge } from './AccountBadge'
import { ContractBadge } from './ContractBadge'
import { DecodedParams } from './EventDetail'
import { ExpandableDetailRow } from './ExpandableDetailRow'

const ActionValue = ({
  children,
  copyValue,
}: {
  children: React.ReactNode
  copyValue: string
}) => (
  <EntityBadge variant="default" type="action" copyValue={copyValue} compact>
    {children}
  </EntityBadge>
)

const muted = 'text-muted-foreground text-p'

const RESOLVER_EVENT_TYPES = new Set([
  'AbiChanged',
  'AddrChanged',
  'AddressChanged',
  'AuthorisationChanged',
  'ContenthashChanged',
  'InterfaceChanged',
  'NameChanged',
  'PubkeyChanged',
  'TextChanged',
  'VersionChanged',
])

/** A name chip when the value resolves to a full ENS name, plain mono text otherwise. */
const NameOrLabel = ({
  value,
  eventName,
}: {
  value?: string | null
  eventName?: string | null
}) => {
  if (!value) return null
  const name = resolveDecodedName(value, eventName)
  return name ? (
    <EntityBadge variant="name" name={name} compact>
      {name}
    </EntityBadge>
  ) : (
    <ActionValue copyValue={value}>{value}</ActionValue>
  )
}

const EventContent = ({ event }: { event: TimelineIndexerEvent }) =>
  match(event.type)
    .with('LabelRegistered', () => (
      <>
        <span className={muted}>created label</span>
        <NameOrLabel
          value={event.asLabelRegistered?.name}
          eventName={event.name}
        />
      </>
    ))
    .with('NameRegistered', () => (
      <>
        <span className={muted}>registered</span>
        <NameOrLabel
          value={event.asNameRegistered?.name ?? event.name}
          eventName={event.name}
        />
      </>
    ))
    .with('Transfer', () => {
      const from = event.asTransfer?.from
      const isMint = from?.toLowerCase() === zeroAddress
      return (
        <>
          <span className={muted}>
            {isMint ? 'minted token ID' : 'transferred token ID'}
          </span>
          {event.asTransfer?.id && (
            <ActionValue copyValue={event.asTransfer.id}>
              {truncateAddress(event.asTransfer.id)}
            </ActionValue>
          )}
        </>
      )
    })
    .with('EACRolesChanged', () => {
      const change = decodeRoleChange(event.data)
      const verb = change.direction === 'revoke' ? 'revoked from' : 'granted to'
      return (
        <>
          <span className={muted}>
            {change.roles.length || ''}{' '}
            {change.roles.length === 1 ? 'role' : 'roles'} {verb}
          </span>
          {change.account && isAddress(change.account, { strict: false }) && (
            <AccountBadge address={change.account} />
          )}
        </>
      )
    })
    .with('TextChanged', () => (
      <>
        <span className={muted}>set</span>
        {event.asTextChanged?.key && (
          <ActionValue copyValue={event.asTextChanged.key}>
            {event.asTextChanged.key}
          </ActionValue>
        )}
      </>
    ))
    .otherwise(() => null)

interface EventRowProps {
  readonly event: TimelineIndexerEvent
}

export const EventRow = ({ event }: EventRowProps) => {
  const contractAddress = event.contractAddress ?? undefined

  return (
    <ExpandableDetailRow
      left={
        <>
          <ActionValue copyValue={event.type}>{event.type}</ActionValue>
          <EventContent event={event} />
        </>
      }
      right={
        contractAddress ? (
          <ContractBadge
            address={contractAddress}
            label={
              RESOLVER_EVENT_TYPES.has(event.type) ? 'resolver' : undefined
            }
          />
        ) : undefined
      }
      disclosure={<DecodedParams event={event} />}
    />
  )
}
