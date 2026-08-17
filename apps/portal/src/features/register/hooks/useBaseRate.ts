import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  getBaseRates as ensGetBaseRates,
  type GetBaseRatesErrorType,
} from '@ensdomains/ensjs/public/v2'
import { useQuery } from '@tanstack/react-query'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'
import { getLabel } from '@/utils/token/getLabel'

export class GetBaseRatesError extends TaggedError('GetBaseRatesError')<{
  readonly cause: GetBaseRatesErrorType
}> {}

const getBaseRatesQueryKey = createQueryKey<'get-base-rates', object>(
  'get-base-rates',
)

export const getBaseRatesQueryOptions = resultQueryOptions({
  queryKey: getBaseRatesQueryKey({}),
  staleTime: Number.POSITIVE_INFINITY,
  queryFn: () => getBaseRates(),
})

export const getBaseRates = ResultFn(async function* () {
  const client = yield* safeGetClient()

  const rates = yield* fromPromise(
    ensGetBaseRates(client),
    (e) => new GetBaseRatesError({ cause: e as GetBaseRatesErrorType }),
  )

  return ok(rates)
})

/**
 * Looks up the per-second oracle base rate for a name's label length.
 * Mirrors StandardRentPriceOracle.baseRate(): clamps to last entry for
 * names longer than the rate table. Returns 0n if rates are missing.
 *
 * Length is counted in Unicode codepoints to match the contract's
 * `StringUtils.strlen` (which counts UTF-8 codepoints). Spreading the string
 * iterates by codepoint — collapsing surrogate pairs — unlike `.length`, which
 * counts UTF-16 code units and would over-count emoji / multi-byte labels.
 */
export const getBaseRateForName = (
  rates: readonly bigint[] | undefined,
  name: string,
): bigint => {
  if (!rates || rates.length === 0) return 0n

  let labelLength: number
  try {
    labelLength = [...getLabel(name)].length
  } catch {
    return 0n
  }

  if (labelLength === 0) return 0n
  const idx = Math.min(labelLength, rates.length) - 1
  return rates[idx] ?? 0n
}

/**
 * Returns the raw per-second oracle base rate (in oracle units, 12 decimals)
 * for the given ENS name. Returns 0n while loading or on error.
 */
export const useBaseRate = (name: string): bigint => {
  const { data } = useQuery(getBaseRatesQueryOptions)
  return getBaseRateForName(data, name)
}
