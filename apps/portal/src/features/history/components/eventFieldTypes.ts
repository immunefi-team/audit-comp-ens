import type {
  TimelineDecoded,
  TimelineIndexerEvent,
} from '../hooks/useNameHistoryTimeline'
import { parseEventData } from '../summarize/decodeRawData'

/**
 * Solidity types for the indexer's decoded event payloads, keyed by event type.
 * Field names mirror the `as*` payloads fetched by the history timeline query
 * (plus EACRolesChanged, whose canonical fields arrive via the raw data blob).
 */
const FIELD_TYPES: Record<string, Record<string, string>> = {
  AddressChanged: {
    address: 'bytes',
    coinType: 'uint256',
    resolver: 'address',
    namehash: 'bytes32',
  },
  // AddrChanged shares the asAddressChanged payload.
  AddrChanged: {
    address: 'bytes',
    coinType: 'uint256',
    resolver: 'address',
    namehash: 'bytes32',
  },
  TextChanged: {
    key: 'string',
    value: 'string',
    resolver: 'address',
    namehash: 'bytes32',
  },
  Transfer: {
    from: 'address',
    to: 'address',
    id: 'uint256',
    operator: 'address',
    value: 'uint256',
  },
  RegistryTransfer: { node: 'bytes32', owner: 'address' },
  LabelRegistered: {
    name: 'string',
    owner: 'address',
    registry: 'address',
    tokenId: 'uint256',
    sender: 'address',
    canonicalId: 'uint256',
    expiry: 'uint64',
  },
  NameRegistered: {
    name: 'string',
    label: 'bytes32',
    owner: 'address',
    cost: 'uint256',
    baseCost: 'uint256',
    premium: 'uint256',
    referrer: 'bytes32',
    expires: 'uint64',
  },
  NameRenewed: { id: 'uint256', expires: 'uint64' },
  ResolverUpdated: {
    resolver: 'address',
    sender: 'address',
    tokenId: 'uint256',
  },
  ReverseClaimed: { address: 'address', node: 'bytes32' },
  NameWrapped: {
    node: 'bytes32',
    owner: 'address',
    fuses: 'uint32',
    expiry: 'uint64',
  },
  NameUnwrapped: { node: 'bytes32', owner: 'address' },
  FusesSet: { node: 'bytes32', fuses: 'uint32' },
  ExpiryUpdated: { node: 'bytes32', tokenId: 'uint256', expiry: 'uint64' },
  EACRolesChanged: {
    resource: 'uint256',
    account: 'address',
    oldRoleBitmap: 'uint256',
    newRoleBitmap: 'uint256',
  },
  NewOwner: { owner: 'address', node: 'bytes32', parent: 'string' },
  NewTTL: { node: 'bytes32', ttl: 'uint64' },
  WrappedTransfer: { node: 'bytes32', owner: 'address' },
  NameTransferred: { node: 'bytes32', newOwner: 'address' },
  AbiChanged: { node: 'bytes32', resolver: 'address', contentType: 'uint256' },
  PubkeyChanged: {
    node: 'bytes32',
    resolver: 'address',
    x: 'bytes32',
    y: 'bytes32',
  },
  InterfaceChanged: {
    node: 'bytes32',
    resolver: 'address',
    interfaceID: 'bytes4',
    implementer: 'address',
  },
  AuthorisationChanged: {
    node: 'bytes32',
    resolver: 'address',
    owner: 'address',
    target: 'address',
    isAuthorized: 'bool',
  },
  VersionChanged: { node: 'bytes32', resolver: 'address', version: 'uint64' },
  ContenthashChanged: { node: 'bytes32', resolver: 'address', hash: 'bytes' },
  NameChanged: { node: 'bytes32', resolver: 'address', name: 'string' },
  SubregistryUpdated: {
    name: 'string',
    canonicalId: 'uint256',
    tokenId: 'uint256',
    subregistry: 'address',
    registry: 'address',
    sender: 'address',
  },
}

const PAYLOAD_KEY_BY_TYPE: Record<string, keyof TimelineDecoded> = {
  AddressChanged: 'asAddressChanged',
  AddrChanged: 'asAddressChanged',
  TextChanged: 'asTextChanged',
  Transfer: 'asTransfer',
  RegistryTransfer: 'asRegistryTransfer',
  LabelRegistered: 'asLabelRegistered',
  NameRegistered: 'asNameRegistered',
  NameRenewed: 'asNameRenewed',
  ResolverUpdated: 'asResolverUpdated',
  ReverseClaimed: 'asReverseClaimed',
  NameWrapped: 'asNameWrapped',
  NameUnwrapped: 'asNameUnwrapped',
  FusesSet: 'asFusesSet',
  ExpiryUpdated: 'asExpiryUpdated',
}

export const getTimelineFieldType = (
  eventType: string,
  fieldKey: string,
): string => FIELD_TYPES[eventType]?.[fieldKey] ?? 'unknown'

/** Typed `as*` payload for `event.type`, else the raw `data` blob. */
export const getDecodedParamEntries = (
  event: TimelineIndexerEvent,
): ReadonlyArray<readonly [string, string]> => {
  const payloadKey = PAYLOAD_KEY_BY_TYPE[event.type]
  const source = (payloadKey && event[payloadKey]) || parseEventData(event.data)
  return Object.entries(source)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => [key, String(value)] as const)
}
