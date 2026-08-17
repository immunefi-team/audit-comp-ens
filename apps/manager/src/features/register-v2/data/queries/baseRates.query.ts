import { TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  getBaseRates as ensGetBaseRates,
  type GetBaseRatesErrorType,
} from '@ensdomains/ensjs/public/v2'
import { useQuery } from '@tanstack/react-query'
import { fromPromise } from 'neverthrow'
import { publicClient } from '@/lib/wagmi'
import { getLabelLength } from '../../utils/name-parser'

export class GetBaseRatesError extends TaggedError('GetBaseRatesError')<{
  readonly cause: GetBaseRatesErrorType
}> {}

export const getBaseRates = () =>
  fromPromise(
    ensGetBaseRates(publicClient),
    (e) => new GetBaseRatesError({ cause: e as GetBaseRatesErrorType }),
  )

export const getBaseRatesQueryOptions = resultQueryOptions({
  queryKey: $qk({
    $service: 'standard-rent-price-oracle',
    $action: 'get-base-rates',
  }),
  staleTime: Number.POSITIVE_INFINITY,
  queryFn: () => getBaseRates(),
})

export const useBaseRate = (label: string) => {
  const baseRates = useQuery(getBaseRatesQueryOptions)

  if (!baseRates.data) {
    return 0n
  }

  const labelLength = Math.min(getLabelLength(label), baseRates.data.length)
  const baseRate = baseRates.data[labelLength - 1]

  if (baseRate === undefined) {
    return 0n
  }

  return baseRate
}
