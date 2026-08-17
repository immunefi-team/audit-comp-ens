import { isAddress, zeroAddress } from 'viem'
import { formatRoleLabel } from '@/lib/roles/formatRoleLabel'
import { truncateAddress } from '@/utils/formatting/truncateAddress'
import { V1_PROTOCOL } from '../hooks/useNameHistoryTimeline'
import {
  decodeRoleChange,
  parseEventData,
  readString,
  resolveDecodedName,
} from './decodeRawData'
import type { ActionSlot, Descriptor } from './summarize.types'

const isZero = (value?: string | null): boolean =>
  !value || value.toLowerCase() === zeroAddress

export const humanizeType = (type: string): string =>
  type
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)(?=[A-Z][a-z])/g, '$1 ')
    .split(' ')
    .map((word, index) => {
      if (word.length > 1 && word === word.toUpperCase()) return word
      const lower = word.toLowerCase()
      return index === 0
        ? lower.charAt(0).toUpperCase() + lower.slice(1)
        : lower
    })
    .join(' ')

const nameSlot = (value?: string | null): ActionSlot =>
  value ? { kind: 'name', value } : { kind: 'placeholder', value: '—' }

const addressSlot = (value?: string | null): ActionSlot =>
  value && isAddress(value, { strict: false })
    ? { kind: 'address', value }
    : { kind: 'placeholder', value: '—' }

const contractSlot = (
  value?: string | null,
  opts?: { isRegistry?: boolean; label?: string },
): ActionSlot => {
  if (!value || !isAddress(value, { strict: false })) {
    return { kind: 'placeholder', value: '—' }
  }
  return {
    kind: 'contract',
    value,
    ...(opts?.isRegistry ? { isRegistry: true } : {}),
    ...(opts?.label ? { label: opts.label } : {}),
  }
}

const resolvedNameSlot = (
  candidate?: string | null,
  eventName?: string | null,
): ActionSlot =>
  nameSlot(
    (candidate ? resolveDecodedName(candidate, eventName) : undefined) ??
      eventName,
  )

export const DESCRIPTORS: Record<string, Descriptor> = {
  AddressChanged: {
    icon: 'address',
    build: (primary) => ({
      label: 'Set address to',
      slots: [addressSlot(primary.asAddressChanged?.address)],
    }),
  },
  AddrChanged: {
    icon: 'address',
    build: (primary) => ({
      label: 'Set address to',
      slots: [
        addressSlot(
          primary.asAddressChanged?.address ??
            readString(parseEventData(primary.data), 'address', 'addr'),
        ),
      ],
    }),
  },

  TextChanged: {
    icon: 'text',
    build: (primary) => {
      const key = primary.asTextChanged?.key ?? primary.key ?? '—'
      const value = primary.asTextChanged?.value ?? primary.value ?? ''
      const slots: ActionSlot[] = [{ kind: 'text', value: key }]
      if (value) {
        slots.push({ kind: 'glyph', value: '→' }, { kind: 'text', value })
      }
      return { label: 'Set text record', slots }
    },
  },

  ContenthashChanged: {
    icon: 'contenthash',
    build: (primary) => {
      const hash = readString(
        parseEventData(primary.data),
        'hash',
        'contentHash',
      )
      return {
        label: 'Set content hash',
        slots: [
          {
            kind: 'text',
            value: hash ? truncateAddress(hash, 6, 4, '…') : '—',
          },
        ],
      }
    },
  },

  NameChanged: {
    icon: 'primary',
    build: (primary) => {
      const setName =
        readString(parseEventData(primary.data), 'name') ?? primary.name
      return {
        label: 'Set primary name',
        slots: [nameSlot(setName)],
      }
    },
  },
  ReverseClaimed: {
    icon: 'primary',
    build: (primary) => ({
      label: 'Set primary name',
      slots: [
        nameSlot(primary.name),
        { kind: 'glyph', value: '↔' },
        addressSlot(primary.asReverseClaimed?.address),
      ],
    }),
  },

  Transfer: {
    icon: 'transfer',
    build: (primary) => {
      if (isZero(primary.asTransfer?.from)) return null
      return {
        label: 'Transfer name',
        slots: [
          nameSlot(primary.name),
          { kind: 'glyph', value: '→' },
          addressSlot(primary.asTransfer?.to),
        ],
      }
    },
  },
  RegistryTransfer: {
    icon: 'transfer',
    build: (primary) => ({
      label: 'Transfer name',
      slots: [
        nameSlot(primary.name),
        { kind: 'glyph', value: '→' },
        addressSlot(primary.asRegistryTransfer?.owner),
      ],
    }),
  },

  LabelRegistered: {
    icon: 'subname',
    build: (primary) => ({
      label: 'Register subname',
      slots: [resolvedNameSlot(primary.asLabelRegistered?.name, primary.name)],
    }),
  },
  NameRegistered: {
    icon: 'register',
    build: (primary) => ({
      label: 'Register name',
      slots: [
        resolvedNameSlot(primary.asNameRegistered?.name, primary.name),
        { kind: 'connective', value: 'by' },
        { kind: 'actor', txHash: primary.transactionHash },
      ],
    }),
  },
  NameRenewed: {
    icon: 'renew',
    build: (primary) => ({
      label: 'Renew',
      slots: [
        { kind: 'connective', value: 'by' },
        { kind: 'actor', txHash: primary.transactionHash },
      ],
    }),
  },

  ResolverUpdated: {
    icon: 'resolver',
    build: (primary) => ({
      label: 'Update resolver',
      slots: [
        contractSlot(primary.asResolverUpdated?.resolver, {
          label: 'resolver',
        }),
      ],
    }),
  },

  SubregistryUpdated: {
    icon: 'registry',
    build: (primary) => {
      const registry = readString(
        parseEventData(primary.data),
        'registry',
        'subregistry',
      )
      if (isZero(registry)) {
        return { label: 'Unlink subregistry', slots: [] }
      }
      return {
        label: 'Deploy and link subregistry',
        slots: [contractSlot(registry, { isRegistry: true })],
      }
    },
  },

  EACRolesChanged: {
    icon: 'grant',
    build: (primary) => {
      const change = decodeRoleChange(primary.data)
      const roleText =
        change.roles
          .map((role) =>
            role.endsWith('_ADMIN')
              ? `${formatRoleLabel(role)} Admin`
              : formatRoleLabel(role),
          )
          .join(', ') || 'roles'
      const account: ActionSlot =
        change.account && isAddress(change.account, { strict: false })
          ? {
              kind: 'actor',
              txHash: primary.transactionHash,
              address: change.account,
            }
          : { kind: 'placeholder', value: '—' }

      if (change.direction === 'revoke') {
        return {
          icon: 'revoke',
          label: 'Revoke role',
          slots: [
            { kind: 'text', value: roleText },
            { kind: 'connective', value: 'from' },
            account,
          ],
        }
      }
      if (change.direction === 'grant') {
        return {
          label: 'Grant role',
          slots: [
            { kind: 'text', value: roleText },
            { kind: 'connective', value: 'to' },
            account,
          ],
        }
      }
      return {
        label: 'Update roles',
        slots: [{ kind: 'text', value: roleText }],
      }
    },
  },

  // The only two type names that mean different things across protocols: under
  // v1 these are the NameWrapper's wrap/unwrap, not the migration to v2.
  NameWrapped: {
    icon: 'migrate',
    build: (primary) =>
      primary.protocol === V1_PROTOCOL
        ? {
            label: 'Wrap name',
            slots: [
              nameSlot(primary.name),
              { kind: 'connective', value: 'for' },
              addressSlot(primary.asNameWrapped?.owner),
            ],
          }
        : { label: 'Migrated to ENSv2', slots: [] },
  },
  NameUnwrapped: {
    icon: 'migrate',
    build: (primary) =>
      primary.protocol === V1_PROTOCOL
        ? {
            label: 'Unwrap name',
            slots: [
              nameSlot(primary.name),
              { kind: 'connective', value: 'to' },
              addressSlot(primary.asNameUnwrapped?.owner),
            ],
          }
        : { label: 'Unwrapped from ENSv2', slots: [] },
  },
  FusesSet: {
    icon: 'fuses',
    build: () => ({ label: 'Set fuses', slots: [] }),
  },
  ExpiryUpdated: {
    icon: 'expiry',
    build: () => ({ label: 'Expiry updated', slots: [] }),
  },

  // ENS v1 types with no v2 counterpart, so no collision to disambiguate.
  // The v1 resolver events left out here (AbiChanged, PubkeyChanged,
  // VersionChanged, …) read fine straight from `humanizeType`.
  NewOwner: {
    icon: 'registry',
    build: (primary) => ({
      label: 'Set registry owner',
      slots: [addressSlot(primary.asRegistryTransfer?.owner)],
    }),
  },
  WrappedTransfer: {
    icon: 'transfer',
    build: (primary) => ({
      label: 'Transfer wrapped name',
      slots: [
        nameSlot(primary.name),
        { kind: 'glyph', value: '→' },
        addressSlot(primary.asTransfer?.to),
      ],
    }),
  },
  NameTransferred: {
    icon: 'transfer',
    build: (primary) => ({
      label: 'Transfer registrant',
      slots: [
        { kind: 'connective', value: 'to' },
        addressSlot(readString(parseEventData(primary.data), 'newOwner')),
      ],
    }),
  },
}
