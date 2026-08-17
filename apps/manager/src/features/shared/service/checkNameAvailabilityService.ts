import { TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import { skipToken } from '@tanstack/react-query'
import { toLabel } from '@/features/shared/registration/nameUtils'
import {
  checkRealNameAvailability,
  getTokenPrices,
} from '@/features/shared/service/nameChainContractService'

export class NameAvailabilityError extends TaggedError(
  'NameAvailabilityError',
)<{
  cause: unknown
}> {}

export const searchNameQueryKey = createQueryKey<
  'searchName',
  {
    name: string
  }
>('searchName')

export const getSearchNameQueryOptions = (name: string) =>
  resultQueryOptions({
    queryKey: searchNameQueryKey({ name }),
    queryFn: ({ queryKey: [, { name }] }) => checkRealNameAvailability(name),
  })

// Pricing query options
export const namePricingQueryKey = createQueryKey<
  'namePricing',
  {
    name: string
  }
>('namePricing')

export const getNamePricingQueryOptions = (name: string | undefined) =>
  resultQueryOptions({
    queryKey: namePricingQueryKey({ name: name ?? '' }),
    // `getTokenPrices` prices a bare label; callers hold full `.eth` names.
    queryFn: name ? () => getTokenPrices(toLabel(name), 1) : skipToken,
  })
