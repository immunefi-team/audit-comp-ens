import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import type {
  GetResolvedNamesForAddressErrorType,
  GetResolvedNamesForAddressParameters,
} from '@ensdomains/ensjs/subgraph'
import { getResolvedNamesForAddress as ensjs_getResolvedNamesForAddress } from '@ensdomains/ensjs/subgraph'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'

export class GetResolvedNamesForAddressError extends TaggedError(
  'GetResolvedNamesForAddressError',
)<{
  cause: GetResolvedNamesForAddressErrorType
}> {}

export const getResolvedNamesForAddress = ResultFn(async function* (
  params: GetResolvedNamesForAddressParameters,
) {
  const client = yield* safeGetClient()

  const result = yield* fromPromise(
    ensjs_getResolvedNamesForAddress(client, params),
    (e) =>
      new GetResolvedNamesForAddressError({
        cause: e as GetResolvedNamesForAddressErrorType,
      }),
  )

  return ok(result)
})

export const getResolvedNamesForAddressQueryKey = createQueryKey<
  'get-resolved-names-for-address',
  GetResolvedNamesForAddressParameters
>('get-resolved-names-for-address')

export const getResolvedNamesForAddressQueryOptions = (
  params: GetResolvedNamesForAddressParameters,
) =>
  resultQueryOptions({
    queryKey: getResolvedNamesForAddressQueryKey(params),
    queryFn: () => getResolvedNamesForAddress(params),
  })
