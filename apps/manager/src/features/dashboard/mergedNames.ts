import type { DomainFragment } from '@ens-apps/indexer'
import {
  getDaysSinceExpiry,
  getDisplayExpiryDate,
  getGraceEndDate,
  isInGracePeriod,
} from '@/features/grace/utils/gracePeriod'
import type { V1Domain } from '@/features/migration/service/v1SubgraphClient'
import type { RenewalProtocol } from '@/features/renew/utils/renewalProtocol'
import {
  formatDashboardDate,
  getDaysUntil,
  isExpiringSoon,
  NON_EXPIRING_DATE_LABEL,
  resolveDomainLabel,
  toDateFromSeconds,
} from './utils'

export type MergedItem =
  | {
      readonly kind: 'v2'
      readonly key: string
      readonly sortName: string
      readonly sortExpiry: number | null
      readonly sortCreated: number | null
      readonly domain: DashboardV2Name
    }
  | {
      readonly kind: 'v1'
      readonly key: string
      readonly sortName: string
      readonly sortExpiry: number | null
      readonly sortCreated: number | null
      readonly classified: DashboardV1Name
    }

export type DashboardV1Name = {
  readonly domain: V1Domain
  readonly label: string
  readonly isMigrationEligible?: boolean
  readonly nameRoles?: readonly DashboardNameRole[]
}

export type DashboardNameRole = 'owner' | 'manager'

export type DashboardV2Name = DomainFragment & {
  readonly nameRoles?: readonly DashboardNameRole[]
}

export type SortField = 'name' | 'created' | 'expiry'
export type SortDir = 'asc' | 'desc'
export type ExpiryCta = 'renew' | 'remindMe'

const RENEW_CTA_THRESHOLD_DAYS = 7

const getIsMigrationEligible = (item: MergedItem): boolean =>
  item.kind === 'v1' && item.classified.isMigrationEligible === true

const protocolFor = (isV1: boolean): RenewalProtocol => (isV1 ? 'v1' : 'v2')

const getMergedExpiryDate = (expirySeconds: number | null): Date | null =>
  expirySeconds === 0 ? null : toDateFromSeconds(expirySeconds)

const getExpirySortValue = (expirySeconds: number | null): number | null =>
  expirySeconds === 0 ? null : expirySeconds

const formatMergedExpiryDate = (
  displayExpiryDate: Date | null,
  expirySeconds: number | null,
): string =>
  expirySeconds === 0
    ? NON_EXPIRING_DATE_LABEL
    : formatDashboardDate(displayExpiryDate)

const normalizeMergedName = (name: string | null | undefined): string | null =>
  name ? name.toLowerCase() : null

const getV2NameSet = (
  v2Names: readonly DashboardV2Name[],
): ReadonlySet<string> =>
  new Set(
    v2Names
      .map((domain) => normalizeMergedName(resolveDomainLabel(domain)))
      .filter((name): name is string => !!name),
  )

export const v1ExpirySeconds = (classified: DashboardV1Name): number | null => {
  const raw =
    classified.domain.registration?.expiryDate ??
    classified.domain.wrappedDomain?.expiryDate ??
    null
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export const compareMerged = (
  a: MergedItem,
  b: MergedItem,
  field: SortField,
  dir: SortDir,
): number => {
  const mul = dir === 'asc' ? 1 : -1
  if (field === 'name') {
    return a.sortName.localeCompare(b.sortName) * mul
  }
  const ax =
    field === 'created' ? a.sortCreated : getExpirySortValue(a.sortExpiry)
  const bx =
    field === 'created' ? b.sortCreated : getExpirySortValue(b.sortExpiry)
  if (ax === null && bx === null) return 0
  if (ax === null) return 1
  if (bx === null) return -1
  return (ax - bx) * mul
}

export const buildMergedNamesList = (params: {
  v2Names: readonly DashboardV2Name[]
  v1Classified: readonly DashboardV1Name[]
  searchQuery: string
  sortField: SortField
  sortDir: SortDir
}): MergedItem[] => {
  const { v2Names, v1Classified, searchQuery, sortField, sortDir } = params
  const q = searchQuery.trim().toLowerCase()
  const items: MergedItem[] = []
  const v2NameSet = getV2NameSet(v2Names)

  for (const domain of v2Names) {
    const label = resolveDomainLabel(domain)
    if (q && !label.toLowerCase().includes(q)) continue
    items.push({
      kind: 'v2',
      key: `v2-${domain.id}`,
      sortName: label,
      sortExpiry: domain.expiryDate ?? null,
      sortCreated: domain.createdAt,
      domain,
    })
  }

  for (const classified of v1Classified) {
    const label = classified.domain.name
    if (v2NameSet.has(label.toLowerCase())) continue
    if (
      q &&
      !label.toLowerCase().includes(q) &&
      !classified.label.toLowerCase().includes(q)
    ) {
      continue
    }
    items.push({
      kind: 'v1',
      key: `v1-${classified.domain.id}`,
      sortName: label,
      sortExpiry: v1ExpirySeconds(classified),
      sortCreated: null,
      classified,
    })
  }

  items.sort((a, b) => compareMerged(a, b, sortField, sortDir))
  return items
}

export const getMergedNamesCount = (params: {
  v2Names: readonly DashboardV2Name[]
  v1Classified: readonly DashboardV1Name[]
}): number => {
  const v2NameSet = getV2NameSet(params.v2Names)
  const v1OnlyCount = params.v1Classified.filter(
    (classified) => !v2NameSet.has(classified.domain.name.toLowerCase()),
  ).length

  return params.v2Names.length + v1OnlyCount
}

export type MergedRowMetadata = {
  readonly label: string
  readonly expiryDate: Date | null
  readonly displayExpiryDate: Date | null
  readonly graceEndDate: Date | null
  readonly daysUntilExpiry: number | null
  readonly daysSinceExpiry: number | null
  readonly expiringSoon: boolean
  readonly formattedExpiryDate: string
  readonly isV1: boolean
  readonly isPrimary: boolean
  readonly isInGrace: boolean
  readonly showProminentRenew: boolean
  readonly expiryCta: ExpiryCta | null
  readonly useDefaultAvatar: boolean
  readonly avatarUrl: string | undefined
  readonly isMigrationEligible: boolean
}

export const mergedRowMetadata = (
  item: MergedItem,
  primaryLabel?: string | null,
  avatarOverride?: string,
  now: Date = new Date(),
): MergedRowMetadata => {
  const label = item.sortName
  const expiryDate = getMergedExpiryDate(item.sortExpiry)
  const isV1 = item.kind === 'v1'
  const protocol = protocolFor(isV1)
  const isInGrace = isInGracePeriod(expiryDate, protocol, now)
  const graceEndDate =
    expiryDate && isInGrace ? getGraceEndDate(expiryDate, protocol) : null
  const displayExpiryDate = getDisplayExpiryDate(expiryDate, protocol, now)
  const isMigrationEligible = getIsMigrationEligible(item)
  const daysUntilExpiry = getDaysUntil(expiryDate)
  const daysSinceExpiry =
    expiryDate && isInGrace ? getDaysSinceExpiry(expiryDate, now) : null
  const expiringSoon = isExpiringSoon(expiryDate, 30, daysUntilExpiry)
  const expiryCta =
    protocol === 'v2' && isInGrace
      ? 'renew'
      : protocol === 'v2' && expiringSoon && daysUntilExpiry !== null
        ? daysUntilExpiry <= RENEW_CTA_THRESHOLD_DAYS
          ? 'renew'
          : 'remindMe'
        : null
  const isPrimary =
    !isV1 &&
    !!primaryLabel &&
    label.toLowerCase() === primaryLabel.toLowerCase()
  const avatarUrl = isV1 || isInGrace ? undefined : avatarOverride

  return {
    label,
    expiryDate,
    displayExpiryDate,
    graceEndDate,
    daysUntilExpiry,
    daysSinceExpiry,
    expiringSoon,
    formattedExpiryDate: formatMergedExpiryDate(
      displayExpiryDate,
      item.sortExpiry,
    ),
    isV1,
    isPrimary,
    isInGrace,
    showProminentRenew: expiryCta === 'renew',
    expiryCta,
    useDefaultAvatar: isInGrace,
    avatarUrl,
    isMigrationEligible,
  }
}
