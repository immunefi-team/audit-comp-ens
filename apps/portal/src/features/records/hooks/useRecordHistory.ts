import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import type { GetSupportedInterfacesErrorType } from '@ensdomains/ensjs/public'
import type {
  GetRecordHistoryErrorType,
  GetRecordHistoryParameters,
} from '@ensdomains/ensjs/subgraph'
import { getRecordHistory as ensjs_getRecordHistory } from '@ensdomains/ensjs/subgraph'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'

class GetRecordHistoryError extends TaggedError('GetRecordHistoryError')<{
  cause: GetRecordHistoryErrorType
}> {}

const getRecordHistory = ResultFn(async function* (
  params: GetRecordHistoryParameters,
) {
  const client = yield* safeGetClient()

  const events = yield* fromPromise(
    ensjs_getRecordHistory(client, params),
    (e) => {
      return new GetRecordHistoryError({
        cause: e as GetSupportedInterfacesErrorType,
      })
    },
  )
  return ok(events || [])
})

const getRecordHistoryQueryKey = createQueryKey<
  'get-record-history',
  GetRecordHistoryParameters
>('get-record-history')

export const getRecordHistoryQueryOptions = (
  params: GetRecordHistoryParameters,
) =>
  resultQueryOptions({
    queryKey: getRecordHistoryQueryKey(params),
    queryFn: () => getRecordHistory(params),
  })
