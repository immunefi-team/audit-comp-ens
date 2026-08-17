import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  getWrapperData as ensjs_getWrapperData,
  type GetWrapperDataErrorType,
  type GetWrapperDataParameters,
} from '@ensdomains/ensjs/public/v1'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'

class GetWrapperDataError extends TaggedError('GetWrapperDataError')<{
  cause: GetWrapperDataErrorType
}> {}

const getWrapperData = ResultFn(async function* (
  params: GetWrapperDataParameters,
) {
  const client = yield* safeGetClient()

  const data = yield* await fromPromise(
    ensjs_getWrapperData(client, params),
    (e) =>
      new GetWrapperDataError({
        cause: e as GetWrapperDataErrorType,
      }),
  )
  return ok(data)
})

const getWrapperDataQueryKey = createQueryKey<
  'get-wrapper-data',
  GetWrapperDataParameters
>('get-wrapper-data')

export const getWrapperDataQueryOptions = (params: GetWrapperDataParameters) =>
  resultQueryOptions({
    queryKey: getWrapperDataQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getWrapperData(params),
  })
