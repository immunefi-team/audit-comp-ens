import {
  type SUPPORTED_TOKEN,
  TOKENS,
} from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { addSeconds } from 'date-fns'
import { useMemo } from 'react'
import { getNameRowProfilePreview } from '@/features/dashboard/components/nameRowProfileRecords'
import { profileRecordsQuery } from '@/features/profile/service/profileRecords'
import { getBaseRatesQueryOptions } from '@/features/register-v2/data/queries/baseRates.query'
import { getRenewPriceQueryOptions } from '@/features/register-v2/data/queries/pricing.query'
import { calculateDiscount } from '@/features/register-v2/utils/discount'
import { getLabelLength } from '@/features/register-v2/utils/name-parser'
import { getDurationInSecondsFromYears } from '@/features/register-v2/utils/time'
import { MIN_REGISTER_DURATION_SECONDS } from '@/features/shared/registration/pricing'
import {
  type StablecoinBalance,
  useSmartAccountContext,
} from '@/lib/smart-account'
import { decimalBigintToNumber } from '@/utils/formatting/decimalBigintToNumber'
import { hasInsufficientBalance } from '@/utils/payment'
import type {
  BulkRenewName,
  PresetSummary,
  RenewItem,
  Selection,
  SummaryRow,
} from '../types'
import {
  durationForName,
  newExpiryDateForName,
  PRESETS,
  USDC,
} from '../utils/pricing'

type BulkRenewPayment = {
  readonly isConnected: boolean
  readonly isLoadingBalances: boolean
  readonly stablecoinBalances: readonly StablecoinBalance[]
  /** True when the wallet is connected and the selected coin covers the total. */
  readonly canConfirm: boolean
}

export type UseBulkRenewResult = {
  readonly minSelectableDate: Date
  readonly grandTotal: number
  /** Summed quoted price in token units (for the allowance/permit). */
  readonly sumPriceRaw: bigint
  readonly summaryRows: readonly SummaryRow[]
  /** Per-name renewal inputs for submission. */
  readonly renewItems: readonly RenewItem[]
  /** Aggregate totals per `PRESETS` entry (aligned by index). */
  readonly presetSummaries: readonly PresetSummary[]
  readonly payment: BulkRenewPayment
}

/**
 * All data-fetching and derived pricing for the bulk-renew dialog. Fires N×3
 * preset-price reads, N active-selection reads, and N profile-record reads
 * (all gated on `open`) and folds them into the values the UI renders.
 */
export const useBulkRenew = ({
  names,
  selection,
  selectedToken,
  open,
}: {
  readonly names: readonly BulkRenewName[]
  readonly selection: Selection
  readonly selectedToken: SUPPORTED_TOKEN
  readonly open: boolean
}): UseBulkRenewResult => {
  const count = names.length
  const { stablecoinBalances, isLoadingBalances, isConnected } =
    useSmartAccountContext()

  const minSelectableDate = useMemo(() => {
    const latestExpiry = names.reduce(
      (max, n) => (n.currentExpiry > max ? n.currentExpiry : max),
      0n,
    )
    return addSeconds(
      new Date(Number(latestExpiry) * 1000),
      MIN_REGISTER_DURATION_SECONDS,
    )
  }, [names])

  // Base rates (per label length) drive the discount pills.
  const baseRates = useQuery({ ...getBaseRatesQueryOptions, enabled: open })
  const baseRateFor = (label: string): bigint => {
    const data = baseRates.data
    if (!data) return 0n
    return data[Math.min(getLabelLength(label), data.length) - 1] ?? 0n
  }

  const presetQueries = useQueries({
    queries: PRESETS.flatMap((preset) =>
      names.map((n) => ({
        ...getRenewPriceQueryOptions(
          n.label,
          getDurationInSecondsFromYears(
            preset.years,
            new Date(Number(n.currentExpiry) * 1000),
          ),
          USDC.symbol,
        ),
        enabled: open,
        select: (data: { amount: bigint }) =>
          decimalBigintToNumber(data.amount, USDC.decimals),
      })),
    ),
  })
  const presetSummaries: readonly PresetSummary[] = PRESETS.map(
    (preset, presetIdx) => {
      let total = 0
      let discountAmount = 0
      let withoutDiscount = 0
      names.forEach((n, i) => {
        const price = presetQueries[presetIdx * count + i]?.data ?? 0
        const discount = calculateDiscount(
          price,
          baseRateFor(n.label),
          BigInt(
            getDurationInSecondsFromYears(
              preset.years,
              new Date(Number(n.currentExpiry) * 1000),
            ),
          ),
        )
        total += price
        discountAmount += discount.discountAmount
        withoutDiscount += discount.basePriceWithoutDiscount
      })
      return {
        total,
        discountAmount,
        discountPercentage:
          withoutDiscount > 0
            ? Math.round((discountAmount / withoutDiscount) * 100)
            : 0,
      }
    },
  )

  // Price of each name at the ACTIVE selection, quoted in the SELECTED token
  // (its decimals) so the raw amounts match what `renew` charges → breakdown
  // list, totals, and the sum used to size the allowance/permit.
  const tokenDecimals = TOKENS[selectedToken].decimals
  const activeQueries = useQueries({
    queries: names.map((n) => {
      const duration = durationForName(selection, n.currentExpiry)
      return {
        // The price query is a number-based boundary — convert the bigint
        // duration to seconds for it.
        ...getRenewPriceQueryOptions(n.label, Number(duration), selectedToken),
        enabled: open && duration > 0n,
        placeholderData: keepPreviousData,
        select: (data: { amount: bigint }) => ({
          amount: data.amount,
          usd: decimalBigintToNumber(data.amount, tokenDecimals),
        }),
      }
    }),
  })
  const grandTotal = activeQueries.reduce(
    (sum, q) => sum + (q.data?.usd ?? 0),
    0,
  )
  const sumPriceRaw = activeQueries.reduce(
    (sum, q) => sum + (q.data?.amount ?? 0n),
    0n,
  )
  // Every active price must resolve before we size the allowance and submit —
  // otherwise sumPriceRaw would undercount still-loading names. `isPlaceholderData`
  // guards the `keepPreviousData` case: a just-changed duration/token still shows
  // the prior quote, which must NOT count as ready or the permit/total would be
  // sized off stale raw units while renewItems already uses the new duration.
  const pricesReady = activeQueries.every(
    (q) => q.data !== undefined && !q.isPlaceholderData,
  )
  const renewItems: readonly RenewItem[] = names.map((n) => ({
    label: n.label,
    duration: durationForName(selection, n.currentExpiry),
  }))

  // Avatars/theme for the breakdown rows.
  const profilePreviews = useQueries({
    queries: names.map((n) => ({
      ...profileRecordsQuery(n.name),
      enabled: open,
    })),
    combine: (results) =>
      results.map((r) => ({ records: r.data, isLoading: r.isLoading })),
  })

  const summaryRows: readonly SummaryRow[] = names.map((n, i) => ({
    key: n.name,
    displayName: n.displayName,
    label: n.label,
    preview: getNameRowProfilePreview({
      label: n.label,
      name: n.name,
      records: profilePreviews[i]?.records,
      isLoading: profilePreviews[i]?.isLoading,
    }),
    subtotal: activeQueries[i]?.data?.usd,
    startDate: new Date(Number(n.currentExpiry) * 1000),
    endDate: newExpiryDateForName(selection, n.currentExpiry),
  }))

  const selectedBalance = stablecoinBalances.find(
    (b) => b.symbol === selectedToken,
  )
  const selectedBalanceUsd = selectedBalance
    ? decimalBigintToNumber(
        BigInt(selectedBalance.balance),
        selectedBalance.decimals,
      )
    : 0

  return {
    minSelectableDate,
    grandTotal,
    sumPriceRaw,
    summaryRows,
    renewItems,
    presetSummaries,
    payment: {
      isConnected,
      isLoadingBalances,
      stablecoinBalances,
      canConfirm:
        isConnected &&
        !isLoadingBalances &&
        pricesReady &&
        grandTotal > 0 &&
        !hasInsufficientBalance(selectedBalanceUsd, grandTotal),
    },
  }
}
