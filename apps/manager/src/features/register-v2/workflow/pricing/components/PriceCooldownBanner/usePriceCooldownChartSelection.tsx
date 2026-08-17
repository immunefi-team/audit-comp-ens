import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { formatUsd } from '@/utils/formatting/formatUsdCeil'
import { formatPremiumDateTimeLocal } from '../../lib/formatPremiumDateTime'
import { formatPriceForInput } from '../../lib/formatPriceForInput'
import {
  dateAtPoint,
  dayAtPrice,
  PREMIUM_RESOLUTION,
  PREMIUM_START_PRICE,
  pointAtPrice,
  posAtPoint,
  UNIT_CHART_GEO,
} from '../temporary-premium/TemporaryPremiumChart'

const MS_PER_DAY = 86_400_000

const MAX_TARGET_PRICE = PREMIUM_START_PRICE

function dateAtPrice(price: number, startDate: Date): Date {
  return new Date(startDate.getTime() + dayAtPrice(price) * MS_PER_DAY)
}

const TARGET_MATCH_TOLERANCE_USD = 1

function parseTargetPriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,]/g, '')
  const lastSeparator = Math.max(
    cleaned.lastIndexOf('.'),
    cleaned.lastIndexOf(','),
  )
  const normalized =
    lastSeparator === -1
      ? cleaned
      : `${cleaned.slice(0, lastSeparator).replace(/[.,]/g, '')}.${cleaned
          .slice(lastSeparator + 1)
          .replace(/[.,]/g, '')}`
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.min(parsed, MAX_TARGET_PRICE)
}

const NO_SELECTION = -1

export type PriceCooldownChartSelection = ReturnType<
  typeof usePriceCooldownChartSelection
>

export function usePriceCooldownChartSelection(
  premiumStartDate: Date,
  nowPoint: number,
) {
  const [selectedPoint, setSelectedPoint] = useState<number>(NO_SELECTION)
  const [targetPriceInput, setTargetPriceInput] = useState('')

  const syncInputFromPoint = useCallback((point: number) => {
    const price = posAtPoint(point, UNIT_CHART_GEO).price
    setTargetPriceInput(formatPriceForInput(price))
  }, [])

  const handleSelectedPointChange = useCallback(
    (point: number) => {
      setSelectedPoint(point)
      syncInputFromPoint(point)
    },
    [syncInputFromPoint],
  )

  const pointFromTypedPrice = useCallback(
    (price: number): number => {
      const point = pointAtPrice(price)
      return point < nowPoint ? NO_SELECTION : point
    },
    [nowPoint],
  )

  const handleTargetPriceInputChange = useCallback(
    (value: string) => {
      setTargetPriceInput(value)
      const parsed = parseTargetPriceInput(value)
      if (parsed === null) return
      setSelectedPoint(pointFromTypedPrice(parsed))
    },
    [pointFromTypedPrice],
  )

  const handleTargetPriceInputBlur = useCallback(() => {
    if (!targetPriceInput.trim()) {
      setSelectedPoint(NO_SELECTION)
      return
    }
    const parsed = parseTargetPriceInput(targetPriceInput)
    if (parsed === null) return
    setSelectedPoint(pointFromTypedPrice(parsed))
    setTargetPriceInput(formatPriceForInput(parsed))
  }, [pointFromTypedPrice, targetPriceInput])

  const targetPriceReachLabel = useMemo((): ReactNode | null => {
    const trimmed = targetPriceInput.trim()
    if (!trimmed) return null
    const parsed = parseTargetPriceInput(trimmed)
    if (parsed === null) return null

    const currentPrice = posAtPoint(nowPoint, UNIT_CHART_GEO).price

    if (parsed === 0) {
      const endDate = dateAtPoint(PREMIUM_RESOLUTION, premiumStartDate)
      return (
        <>
          The fee will reach $0 on{' '}
          <span className="text-[#353535]">
            {formatPremiumDateTimeLocal(endDate.getTime())}
          </span>{' '}
          — the end of the cooldown.
        </>
      )
    }

    if (parsed > currentPrice + TARGET_MATCH_TOLERANCE_USD) {
      return (
        <>
          You&apos;re in luck — the fee is already below your{' '}
          <span className="text-[#353535]">{formatUsd(parsed)}</span> target.
        </>
      )
    }

    if (Math.abs(parsed - currentPrice) <= TARGET_MATCH_TOLERANCE_USD) {
      return (
        <>
          The fee is currently at{' '}
          <span className="text-[#353535]">{formatUsd(currentPrice)}</span>, you
          can buy now.
        </>
      )
    }

    const reachDate = dateAtPrice(parsed, premiumStartDate)
    return (
      <>
        The fee will reach {formatUsd(parsed)} on{' '}
        <span className="text-[#353535]">
          {formatPremiumDateTimeLocal(reachDate.getTime())}.
        </span>
      </>
    )
  }, [nowPoint, premiumStartDate, targetPriceInput])

  const selectedDisplayPrice = useMemo((): number | undefined => {
    if (selectedPoint < 0) return undefined
    const parsed = parseTargetPriceInput(targetPriceInput)
    return parsed ?? undefined
  }, [selectedPoint, targetPriceInput])

  return {
    selectedPoint,
    selectedDisplayPrice,
    targetPriceInput,
    handleSelectedPointChange,
    handleTargetPriceInputChange,
    handleTargetPriceInputBlur,
    targetPriceReachLabel,
  }
}
