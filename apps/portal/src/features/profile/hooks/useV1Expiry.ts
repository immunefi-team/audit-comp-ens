import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  getExpiry as ensjs_getExpiry,
  type GetExpiryErrorType,
  type GetExpiryParameters,
} from '@ensdomains/ensjs/public/v1'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'

class GetExpiryError extends TaggedError('GetExpiryError')<{
  cause: GetExpiryErrorType
}> {}

const getV1Expiry = ResultFn(async function* (params: GetExpiryParameters) {
  const client = yield* safeGetClient()

  const expiry = yield* await fromPromise(
    ensjs_getExpiry(client, params),
    (e) =>
      new GetExpiryError({
        cause: e as GetExpiryErrorType,
      }),
  )
  return ok(expiry)
})

const getV1ExpiryQueryKey = createQueryKey<
  'get-v1-expiry',
  GetExpiryParameters
>('get-v1-expiry')

export const getV1ExpiryQueryOptions = (params: GetExpiryParameters) =>
  resultQueryOptions({
    queryKey: getV1ExpiryQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getV1Expiry(params),
  })
