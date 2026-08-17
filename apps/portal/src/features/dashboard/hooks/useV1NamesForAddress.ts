import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import type {
  GetNamesForAddressErrorType,
  GetNamesForAddressParameters,
} from '@ensdomains/ensjs/subgraph'
import { getNamesForAddress as ensjs_getNamesForAddress } from '@ensdomains/ensjs/subgraph'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'

class GetV1NamesForAddressError extends TaggedError(
  'GetV1NamesForAddressError',
)<{
  cause: GetNamesForAddressErrorType
}> {}

const getV1NamesForAddress = ResultFn(async function* (
  params: GetNamesForAddressParameters,
) {
  const client = yield* safeGetClient()

  const names = yield* await fromPromise(
    ensjs_getNamesForAddress(client, params),
    (e) =>
      new GetV1NamesForAddressError({
        cause: e as GetNamesForAddressErrorType,
      }),
  )
  return ok(names)
})

const getV1NamesForAddressQueryKey = createQueryKey<
  'get-names-for-address',
  GetNamesForAddressParameters
>('get-names-for-address')

export const getV1NamesForAddressQueryOptions = (
  params: GetNamesForAddressParameters,
) =>
  resultQueryOptions({
    queryKey: getV1NamesForAddressQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getV1NamesForAddress(params),
  })
