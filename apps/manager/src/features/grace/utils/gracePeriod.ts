import { match, P } from 'ts-pattern'
import type { RenewalProtocol } from '@/features/renew/utils/renewalProtocol'

export const MS_PER_DAY = 24 * 60 * 60 * 1000
export const GRACE_PERIOD_DAYS = 90
export const V2_GRACE_PERIOD_DAYS = 28
export const PROMINENT_RENEW_THRESHOLD_DAYS = 30

// v1 and v2 registrars give different grace windows, so callers pass the
// protocol the name resolved to rather than a boolean that is easy to get
// backwards or to leave defaulted.
const graceDaysFor = (protocol: RenewalProtocol): number =>
  protocol === 'v2' ? V2_GRACE_PERIOD_DAYS : GRACE_PERIOD_DAYS

export const getGraceEndDate = (
  expiryDate: Date,
  protocol: RenewalProtocol,
): Date => new Date(expiryDate.getTime() + graceDaysFor(protocol) * MS_PER_DAY)

const normalizeExpiryDate = (
  expiryDate: Date | null | undefined,
): Date | null =>
  expiryDate != null && !Number.isNaN(expiryDate.getTime()) ? expiryDate : null

export const isInGracePeriod = (
  expiryDate: Date | null | undefined,
  protocol: RenewalProtocol,
  now: Date = new Date(),
): boolean => {
  const date = normalizeExpiryDate(expiryDate)
  return match(date)
    .with(P.nullish, () => false)
    .when(
      (value) => now <= value,
      () => false,
    )
    .otherwise((value) => now < getGraceEndDate(value, protocol))
}

/** V2 .eth 2LD: renew allowed until grace ends (portal `isExtendable2LD` for ENSv2). */
export const isRenewableV2EthName = (
  name: string,
  expiryDate: Date | null | undefined,
  now: Date = new Date(),
): boolean => {
  const date = normalizeExpiryDate(expiryDate)
  return match({ name, date })
    .with({ name: P.when((value) => !/^[^.]+\.eth$/.test(value)) }, () => false)
    .with(
      { date: P.not(P.nullish) },
      ({ date: value }) =>
        getGraceEndDate(value, 'v2').getTime() > now.getTime(),
    )
    .otherwise(() => false)
}

export const isPastGracePeriod = (
  expiryDate: Date | null | undefined,
  protocol: RenewalProtocol,
  now: Date = new Date(),
): boolean => {
  const date = normalizeExpiryDate(expiryDate)
  return match(date)
    .with(P.nullish, () => false)
    .otherwise((value) => now >= getGraceEndDate(value, protocol))
}

export const getDaysSinceExpiry = (
  expiryDate: Date,
  now: Date = new Date(),
): number =>
  Math.max(0, Math.ceil((now.getTime() - expiryDate.getTime()) / MS_PER_DAY))

export const shouldShowProminentRenew = (
  expiryDate: Date | null | undefined,
  protocol: RenewalProtocol,
  now: Date = new Date(),
): boolean => {
  const date = normalizeExpiryDate(expiryDate)
  return match(date)
    .with(P.nullish, () => false)
    .when(
      (value) => isInGracePeriod(value, protocol, now),
      () => true,
    )
    .otherwise((value) => {
      const daysUntil = Math.ceil(
        (value.getTime() - now.getTime()) / MS_PER_DAY,
      )
      return daysUntil > 0 && daysUntil <= PROMINENT_RENEW_THRESHOLD_DAYS
    })
}

export const getDisplayExpiryDate = (
  expiryDate: Date | null | undefined,
  protocol: RenewalProtocol,
  now: Date = new Date(),
): Date | null => {
  const date = normalizeExpiryDate(expiryDate)
  return match(date)
    .with(P.nullish, () => null)
    .when(
      (value) => isInGracePeriod(value, protocol, now),
      (value) => getGraceEndDate(value, protocol),
    )
    .otherwise((value) => value)
}

export type NameExpiryStatus = {
  readonly expiryDate: Date | null
  readonly isInGrace: boolean
  readonly graceEndDate: Date | null
  readonly daysSinceExpiry: number | null
  readonly displayExpiryDate: Date | null
  readonly isPastGrace: boolean
}

export const getNameExpiryStatus = (
  expiryDate: Date | null | undefined,
  protocol: RenewalProtocol,
  now: Date = new Date(),
): NameExpiryStatus => {
  const date = normalizeExpiryDate(expiryDate)
  const inGrace = date ? isInGracePeriod(date, protocol, now) : false

  return {
    expiryDate: date,
    isInGrace: inGrace,
    graceEndDate: date && inGrace ? getGraceEndDate(date, protocol) : null,
    daysSinceExpiry: date && inGrace ? getDaysSinceExpiry(date, now) : null,
    displayExpiryDate: getDisplayExpiryDate(date, protocol, now),
    isPastGrace: isPastGracePeriod(date, protocol, now),
  }
}
