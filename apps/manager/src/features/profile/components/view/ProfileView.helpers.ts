import {
  getAddressRecordDef,
  getRecordDef,
  getRecordDisplayValue,
  getRecordHref,
} from '@/features/profile/data/records'
import type {
  AddressRecordValue,
  LinkItem,
  ProfileRecords,
  TextRecordValue,
} from '@/features/profile/types'
import { safeHttpHref } from '@/features/profile/utils/safeUrl'
import { parsePrimaryContactKeys } from '../dialogs/edit-profile/tabs/contact/records'

const ETH_COIN_TYPE = 60
const DOMAIN_LIKE_URL = /^[\w.-]+\.[a-z]{2,}(?:[/#?].*)?$/i
const COMPACT_MONTH_LABELS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const
const FULL_MONTH_LABELS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
] as const

type ProfileDetailDateVariant = 'mobile' | 'desktop'

export type ProfileContactItem = {
  readonly key: string
  readonly label: string
  readonly displayPrefix?: string
  readonly displayValue: string
  readonly href?: string
  readonly icon?: NonNullable<ReturnType<typeof getRecordDef>>['icon']
}

export type SafeProfileLink = LinkItem & {
  readonly href: string
  readonly displayHost: string
}

export type ProfileAddressItem = AddressRecordValue & {
  readonly label: string
  readonly notation: string
  readonly icon?: NonNullable<ReturnType<typeof getAddressRecordDef>>['icon']
}

type IndexedProfileAddressItem = ProfileAddressItem & {
  readonly sourceIndex: number
}

const CHAIN_SPECIFIC_ADDRESS_EDGE_LENGTH = 5

export const formatChainSpecificAddress = (value: string): string => {
  const trimmed = value.trim()

  if (trimmed.length <= CHAIN_SPECIFIC_ADDRESS_EDGE_LENGTH * 2) return trimmed

  return `${trimmed.slice(0, CHAIN_SPECIFIC_ADDRESS_EDGE_LENGTH)}...${trimmed.slice(-CHAIN_SPECIFIC_ADDRESS_EDGE_LENGTH)}`
}

/**
 * The profile page is server-rendered, and the server can't know the viewer's
 * timezone — so dates are formatted in UTC during SSR/first paint (deterministic,
 * no hydration mismatch) and re-rendered in the viewer's local timezone once
 * hydrated. Callers pass `timeZone: 'local'` after `useHydrated()` flips true.
 * Local is the app-wide convention (dashboard, registration, and renewal all use
 * it); UTC here is only the SSR default.
 */
export const formatProfileDetailDate = (
  date: Date | null | undefined,
  variant: ProfileDetailDateVariant = 'mobile',
  timeZone: 'utc' | 'local' = 'utc',
) => {
  if (!date || Number.isNaN(date.getTime())) return undefined

  const [monthIndex, dayOfMonth, fullYear] =
    timeZone === 'local'
      ? [date.getMonth(), date.getDate(), date.getFullYear()]
      : [date.getUTCMonth(), date.getUTCDate(), date.getUTCFullYear()]
  const compactMonth = COMPACT_MONTH_LABELS[monthIndex]
  const fullMonth = FULL_MONTH_LABELS[monthIndex]
  if (!compactMonth || !fullMonth) return undefined

  if (variant === 'desktop') {
    return `${fullMonth} ${dayOfMonth}, ${fullYear}`
  }

  const day = String(dayOfMonth).padStart(2, '0')
  return `${compactMonth}.${day}.${fullYear}`
}

const toSafeHttpHref = (value: string): string | undefined => {
  const strictHref = safeHttpHref(value)
  if (strictHref) return strictHref

  const trimmed = value.trim()
  if (!DOMAIN_LIKE_URL.test(trimmed)) return undefined

  return safeHttpHref(`https://${trimmed}`)
}

export const getSafeProfileHref = toSafeHttpHref

export const getDisplayHost = (href: string): string => {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return href
  }
}

export const getSafeProfileLinks = (
  records: ProfileRecords,
): SafeProfileLink[] =>
  records.links.flatMap((link) => {
    const href = toSafeHttpHref(link.url)
    return href ? [{ ...link, href, displayHost: getDisplayHost(href) }] : []
  })

const getRecordFromRecords = (
  records: ProfileRecords,
  key: string,
): TextRecordValue | undefined =>
  [...records.contact, ...records.social].find(
    (record) => record.key === key && record.value.trim() !== '',
  )

const toContactItem = (
  record: TextRecordValue,
): ProfileContactItem | undefined => {
  const recordDef = getRecordDef(record.key)
  const displayValue = getRecordDisplayValue(recordDef, record.value)

  if (!displayValue.trim()) return undefined

  const href = getRecordHref(recordDef, displayValue)

  return {
    key: record.key,
    label: recordDef?.name ?? record.key,
    displayPrefix: recordDef?.displayPrefix,
    displayValue,
    href,
    icon: recordDef?.icon,
  }
}

export const getPrimaryContactItems = (
  records: ProfileRecords,
  limit = 3,
): ProfileContactItem[] => {
  const primaryContactItems = parsePrimaryContactKeys(records.base).flatMap(
    (key) => {
      const record = getRecordFromRecords(records, key)
      if (!record) return []

      const item = toContactItem(record)
      return item ? [item] : []
    },
  )

  if (primaryContactItems.length > 0) {
    return primaryContactItems.slice(0, limit)
  }

  return [...records.contact, ...records.social]
    .flatMap((record) => {
      const item = toContactItem(record)
      return item ? [item] : []
    })
    .slice(0, limit)
}

const toAddressItem = (
  address: AddressRecordValue,
  sourceIndex: number,
): IndexedProfileAddressItem | undefined => {
  const value = address.value.trim()
  if (!value) return undefined

  const recordDef = getAddressRecordDef(address.coinType)
  const notation = (recordDef?.notation ?? `#${address.coinType}`).toUpperCase()

  return {
    ...address,
    value,
    sourceIndex,
    label: recordDef?.name ?? notation,
    notation,
    icon: recordDef?.icon,
  }
}

const omitSourceIndex = ({
  sourceIndex: _sourceIndex,
  ...address
}: IndexedProfileAddressItem): ProfileAddressItem => address

const getAddressItems = (
  records: ProfileRecords,
): IndexedProfileAddressItem[] =>
  records.addresses.flatMap((address, index) => {
    const item = toAddressItem(address, index)
    return item ? [item] : []
  })

const getMainAddressCandidate = (
  records: ProfileRecords,
): IndexedProfileAddressItem | undefined => {
  const addresses = getAddressItems(records)
  return (
    addresses.find((address) => address.coinType === ETH_COIN_TYPE) ??
    addresses[0]
  )
}

export const getMainReceivingAddress = (
  records: ProfileRecords,
): ProfileAddressItem | undefined => {
  const address = getMainAddressCandidate(records)
  return address ? omitSourceIndex(address) : undefined
}

/**
 * Chain icons shown on the main receiving address card: every chain whose
 * address resolves to the same value as the main address (e.g. EVM chains that
 * share a single `0x…` address).
 */
export const getReceivingAddressChains = (
  records: ProfileRecords,
): ProfileAddressItem[] => {
  const mainAddress = getMainAddressCandidate(records)
  if (!mainAddress) return []

  const mainValue = mainAddress.value.toLowerCase()
  return getAddressItems(records)
    .filter((address) => address.value.toLowerCase() === mainValue)
    .map(omitSourceIndex)
}

/**
 * Chain-specific addresses are those that resolve to a different value than the
 * main receiving address, so EVM chains sharing the main `0x…` address are not
 * repeated here (they appear as icons on the main address card instead).
 */
export const getChainSpecificAddresses = (
  records: ProfileRecords,
): ProfileAddressItem[] => {
  const mainAddress = getMainAddressCandidate(records)
  const mainValue = mainAddress?.value.toLowerCase()

  return getAddressItems(records)
    .filter((address) => address.value.toLowerCase() !== mainValue)
    .map(omitSourceIndex)
}
