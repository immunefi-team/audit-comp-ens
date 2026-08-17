import { TOKENS } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { useQueries } from '@tanstack/react-query'
import { useSelector } from '@xstate/react'
import { useCallback, useMemo } from 'react'
import { getStartOfDay } from '@/features/register-v2/utils/time'
import { decimalBigintToNumber } from '@/utils/formatting/decimalBigintToNumber'
import {
  type GetRegisterPriceError,
  getRegisterPriceQueryOptions,
  type MissingTokenError,
} from '../../../data/queries/pricing.query'
import { useRegistrationV2Context } from '../../../state/registrationUi.context'
import { DurationCustomRow } from './DurationCustomRow'
import { DurationPresetRow } from './DurationPresetRow'
import { getComputedDurationPresets } from './durationPresets'

type PresetPricingQuery = {
  isPending: boolean
  error: GetRegisterPriceError | MissingTokenError | null
  data?: {
    totalPrice: number
    basePrice: number
  }
}

export const DurationSelector = () => {
  const { uiActor, label } = useRegistrationV2Context()
  const selectedDuration = useSelector(
    uiActor,
    (state) => state.context.duration,
  )
  const handleDurationSet = useCallback(
    (duration: number) =>
      uiActor.send({ type: 'pricing.duration.set', duration }),
    [uiActor],
  )
  const presetDurations = useMemo(
    () => getComputedDurationPresets(getStartOfDay()),
    [],
  )

  const presetPricingQueries = useQueries({
    queries: presetDurations.map(({ duration }) =>
      getRegisterPriceQueryOptions(label, duration, TOKENS.USDC.symbol),
    ),
    combine: (results) =>
      results.map((result, idx): PresetPricingQuery => {
        const source = presetDurations[idx]
        if (!source) {
          throw new Error('Invalid preset duration index')
        }

        return {
          isPending: result.isPending,
          error: result.error,
          data: result.data
            ? {
                totalPrice: decimalBigintToNumber(
                  result.data.basePrice + result.data.premium,
                  TOKENS.USDC.decimals,
                ),
                basePrice: decimalBigintToNumber(
                  result.data.basePrice,
                  TOKENS.USDC.decimals,
                ),
              }
            : undefined,
        }
      }),
  })

  const selectedPresetIdx = presetDurations.findIndex(
    ({ duration }) => selectedDuration === duration,
  )

  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-xl border-[#DDDDDE] border-[0.5px] bg-white p-3 shadow-temp-card">
      {presetDurations.map((data, idx) => {
        const query = presetPricingQueries[idx]
        if (!query) {
          throw new Error('Invalid preset duration index')
        }

        return (
          <DurationPresetRow
            data={data}
            isLoading={query.isPending}
            isSelected={idx === selectedPresetIdx}
            key={data.duration}
            onSelect={() =>
              uiActor.send({
                type: 'pricing.duration.set',
                duration: data.duration,
              })
            }
            price={query.data?.basePrice}
          />
        )
      })}

      {/*
        DurationCustomRow is memoized so this component's frequent price-query
        re-renders don't reach the open calendar and dismiss its native
        month/year <select>. Keep every prop below referentially stable
        (primitives, or callbacks via useCallback) — passing an inline
        arrow/object/array silently defeats the memo and the dropdown flicker
        regresses.
      */}
      <DurationCustomRow
        isSelected={selectedPresetIdx === -1}
        onDurationSet={handleDurationSet}
        selectedDuration={selectedDuration}
        type="register"
      />
    </div>
  )
}
