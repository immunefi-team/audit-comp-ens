import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  getRecords as ensjs_getRecords,
  type GetRecordsErrorType,
  type GetRecordsParameters,
} from '@ensdomains/ensjs/public'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'

class RecordsError extends TaggedError('RecordsError')<{
  cause: GetRecordsErrorType
}> {}

/**
 * Fetches ENS records for a given name.
 */
export const getRecords = ResultFn(async function* (
  params: GetRecordsParameters,
) {
  const client = yield* safeGetClient()

  const records = yield* fromPromise(
    ensjs_getRecords(client, params),
    (e) => new RecordsError({ cause: e as GetRecordsErrorType }),
  )

  return ok(records)
})

// Query key factory
const recordsQueryKey = createQueryKey<'records', GetRecordsParameters>(
  'records',
)

// React Query options for fetching records
export const getRecordsQueryOptions = (params: GetRecordsParameters) =>
  resultQueryOptions({
    queryKey: recordsQueryKey(params),
    queryFn: ({ queryKey: [, params] }) => getRecords(params),
  })
