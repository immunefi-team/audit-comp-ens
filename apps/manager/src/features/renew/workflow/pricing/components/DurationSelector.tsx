import { TOKENS } from '@ens-apps/transaction-manager/contracts/ens-sepolia'
import { useQueries } from '@tanstack/react-query'
import { useSelector } from '@xstate/react'
import { useMemo } from 'react'
import { DurationCustomRow } from '@/features/register-v2/workflow/pricing/components/DurationCustomRow'
import { DurationPresetRow } from '@/features/register-v2/workflow/pricing/components/DurationPresetRow'
import { getComputedDurationPresets } from '@/features/register-v2/workflow/pricing/components/durationPresets'
import {
  type GetRenewPriceError,
  getRenewPriceQueryOptions,
  type MissingTokenError,
} from '@/features/renew/data/queries/renewPricing.query'
import { useRenewalUiContext } from '@/features/renew/state/renewalUi.context'
import { decimalBigintToNumber } from '@/utils/formatting/decimalBigintToNumber'

type PresetPricingQuery = {
  isPending: boolean
  error: GetRenewPriceError | MissingTokenError | null
  data?: number
}

export const DurationSelector = () => {
  const { uiActor, label, currentExpiry, protocol } = useRenewalUiContext()
  const referenceDate = useMemo(
    () => new Date(Number(currentExpiry) * 1000),
    [currentExpiry],
  )
  const presetDurations = useMemo(
    () => getComputedDurationPresets(referenceDate),
    [referenceDate],
  )
  const selectedDuration = useSelector(
    uiActor,
    (state) => state.context.duration,
  )

  const presetPricingQueries = useQueries({
    queries: presetDurations.map(({ duration }) =>
      getRenewPriceQueryOptions(
        label,
        BigInt(duration),
        TOKENS.USDC.symbol,
        protocol,
      ),
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
            ? decimalBigintToNumber(result.data.amount, TOKENS.USDC.decimals)
            : undefined,
        }
      }),
  })

  const selectedPresetIdx = presetDurations.findIndex(
    ({ duration }) => selectedDuration === BigInt(duration),
  )

  return (
    <div className="flex h-full flex-col justify-between gap-3 rounded-xl border border-[#DDDDDE] bg-white p-3 shadow-temp-card">
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
                duration: BigInt(data.duration),
              })
            }
            price={query.data}
          />
        )
      })}

      <DurationCustomRow
        isSelected={selectedPresetIdx === -1}
        onDurationSet={(duration) =>
          uiActor.send({
            type: 'pricing.duration.set',
            duration: BigInt(duration),
          })
        }
        referenceDate={referenceDate}
        selectedDuration={Number(selectedDuration)}
        type="renew"
      />
    </div>
  )
}
