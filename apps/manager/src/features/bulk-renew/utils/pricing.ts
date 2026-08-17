import { TOKENS } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { differenceInCalendarDays, startOfDay } from 'date-fns'
import { secondsInDay } from 'date-fns/constants'
import {
  getDurationExpiryDateForDisplay,
  getDurationInSecondsFromYears,
} from '@/features/register-v2/utils/time'
import { MIN_REGISTER_DURATION_SECONDS } from '@/features/shared/registration/pricing'
import type { Selection } from '../types'

/** Renewals are paid in stablecoins; USDC is the display/default coin. */
export const USDC = TOKENS.USDC

export type Preset = {
  readonly years: number
  readonly pillClassName: string
}

export const PRESETS: readonly Preset[] = [
  { years: 1, pillClassName: 'bg-ens-citrine-100 text-ens-citrine-500' },
  { years: 3, pillClassName: 'bg-ens-peridot-100 text-ens-peridot-500' },
  { years: 6, pillClassName: 'bg-ens-garnet-100 text-ens-garnet-500' },
]

/** Format a USD amount with cents, e.g. `$1,320.00` (or `—` when unknown). */
export const formatUsdAmount = (value: number): string =>
  Number.isFinite(value)
    ? value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'

const referenceDateOf = (currentExpiry: bigint): Date =>
  new Date(Number(currentExpiry) * 1000)

/**
 * Seconds to renew one name by, for the active selection and the name's current
 * expiry. Mirrors the single-name renew flow exactly (see `DurationCustomRow` /
 * `DurationSelector`): presets use the shared calendar-aligned year helper, and
 * "renew to date" is the whole-calendar-day span from the name's expiry to the
 * picked target, floored at the minimum renewal duration.
 */
export const durationSecondsForName = (
  selection: Selection,
  currentExpiry: bigint,
): number => {
  const referenceDate = referenceDateOf(currentExpiry)
  if (selection.kind === 'preset')
    return getDurationInSecondsFromYears(selection.years, referenceDate)
  return Math.max(
    MIN_REGISTER_DURATION_SECONDS,
    differenceInCalendarDays(
      startOfDay(new Date(selection.targetMs)),
      startOfDay(referenceDate),
    ) * secondsInDay,
  )
}

/** The same duration as on-chain `bigint` seconds for the renew call. */
export const durationForName = (
  selection: Selection,
  currentExpiry: bigint,
): bigint => BigInt(durationSecondsForName(selection, currentExpiry))

/**
 * The name's new expiry as a Date, computed the same way the single-name flow
 * displays it (`getDurationExpiryDateForDisplay`) so the two flows always agree.
 */
export const newExpiryDateForName = (
  selection: Selection,
  currentExpiry: bigint,
): Date =>
  getDurationExpiryDateForDisplay(
    durationSecondsForName(selection, currentExpiry),
    referenceDateOf(currentExpiry),
  )
