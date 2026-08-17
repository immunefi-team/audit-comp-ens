import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  getBaseRateForName,
  getBaseRatesQueryOptions,
} from '@/features/register/hooks/useBaseRate'
import { getRenewalPriceQueryOptions } from '@/features/register/hooks/useRenewalPrice'
import {
  getDurationFromPickerDate,
  getDurationInSecondsFromYears,
  getStartOfToday,
} from '@/features/register/utils/registrationDuration'
import { isPriceResult } from '@/features/register/utils/registrationPrice'
import { SUPPORTED_TOKENS } from '@/lib/constants/tokens'
import { dateToPlainDate } from '@/utils/temporal'
import type { ExtensionSpanType } from '../components/ExtensionDurationOrExpiryPicker'
import {
  computeNamePricingDisplay,
  type NamePricingDisplay,
} from '../utils/computeNamePricingDisplay'
import { getExtensionTargetDate } from '../utils/extensionDurationPicker'
import { getRenewerAddress } from '../utils/renewer'
import type { SelectedName } from './useRenewalTransactions'

export type { NamePricingDisplay }

export type NamePricingData = {
  readonly selectedName: SelectedName
  readonly duration: number
  readonly isLoading: boolean
  readonly display: NamePricingDisplay | null
}

export type MultiNamePricingResult = {
  readonly pricingData: readonly NamePricingData[]
  readonly total: number
  readonly totalDiscount: number
  readonly allLoaded: boolean
}

type RenewalDurationInput = {
  readonly spanType: ExtensionSpanType
  readonly duration: number
  readonly baseDate?: Temporal.PlainDate
  readonly dateModeReferenceDate?: Temporal.PlainDate
}

export const getLatestRenewalExpiry = (
  selectedNames: readonly SelectedName[],
): Date | null =>
  selectedNames.reduce<Date | null>((max, selectedName) => {
    if (!selectedName.expiryDate) return max
    return !max || selectedName.expiryDate > max ? selectedName.expiryDate : max
  }, null)

export const getRenewalDurationSeconds = ({
  spanType,
  duration,
  baseDate,
  dateModeReferenceDate,
}: RenewalDurationInput): number => {
  if (spanType === 'years') {
    return getDurationInSecondsFromYears(duration, baseDate)
  }

  const targetDate = getExtensionTargetDate({
    baseDate: dateModeReferenceDate ?? baseDate ?? getStartOfToday(),
    duration,
    spanType: 'date',
  })

  return getDurationFromPickerDate(targetDate, baseDate)
}

export function useMultiNamePricing(
  selectedNames: readonly SelectedName[],
  spanType: ExtensionSpanType,
  duration: number,
): MultiNamePricingResult {
  const renewalInputs = useMemo(() => {
    const today = getStartOfToday()

    if (spanType === 'years') {
      return selectedNames.map((selectedName) => {
        const base = selectedName.expiryDate
          ? dateToPlainDate(selectedName.expiryDate)
          : today
        return {
          selectedName,
          duration: getRenewalDurationSeconds({
            spanType,
            duration,
            baseDate: base,
          }),
        }
      })
    }

    const latestExpiry = getLatestRenewalExpiry(selectedNames)
    const latestBaseDate = latestExpiry ? dateToPlainDate(latestExpiry) : today

    return selectedNames.map((selectedName) => {
      const base = selectedName.expiryDate
        ? dateToPlainDate(selectedName.expiryDate)
        : today
      return {
        selectedName,
        duration: getRenewalDurationSeconds({
          spanType,
          duration,
          baseDate: base,
          dateModeReferenceDate: latestBaseDate,
        }),
      }
    })
  }, [duration, selectedNames, spanType])

  const priceQueries = useQueries({
    queries: renewalInputs.map((renewal) =>
      getRenewalPriceQueryOptions({
        name: renewal.selectedName.name,
        duration: renewal.duration,
        token: SUPPORTED_TOKENS.USDC,
        renewerAddress: getRenewerAddress(renewal.selectedName.isV2),
      }),
    ),
  })

  const { data: baseRates } = useQuery(getBaseRatesQueryOptions)

  const pricingData: readonly NamePricingData[] = renewalInputs.map(
    (renewal, index) => {
      const query = priceQueries[index]
      const price = query?.data && isPriceResult(query.data) ? query.data : null
      const baseRate = getBaseRateForName(baseRates, renewal.selectedName.name)

      return {
        selectedName: renewal.selectedName,
        duration: renewal.duration,
        isLoading: query?.isLoading ?? true,
        display: price
          ? computeNamePricingDisplay(
              renewal.selectedName,
              price,
              renewal.duration,
              baseRate,
            )
          : null,
      }
    },
  )

  const total = pricingData.reduce(
    (sum, item) => (item.display ? sum + item.display.actualPrice : sum),
    0,
  )
  const totalDiscount = pricingData.reduce(
    (sum, item) => (item.display ? sum + item.display.discountAmount : sum),
    0,
  )
  const allLoaded = pricingData.every((item) => !item.isLoading)

  return { pricingData, total, totalDiscount, allLoaded }
}
