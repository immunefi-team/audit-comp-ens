import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { createQueryKey } from '@ens-apps/utils/tanstack-query/queryKey'
import type { GetSupportedInterfacesErrorType } from '@ensdomains/ensjs/public'
import type {
  GetNameHistoryErrorType,
  GetNameHistoryParameters,
} from '@ensdomains/ensjs/subgraph'
import { getNameHistory as ensjs_getNameHistory } from '@ensdomains/ensjs/subgraph'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'

export class GetNameHistoryError extends TaggedError('GetNameHistoryError')<{
  cause: GetNameHistoryErrorType
}> {}

/**
 * Page size for history queries that render a full event list.
 *
 * Callers MUST pass `first`. The query declares `$first: Int` and fans out to
 * three sibling `events` selections (domain, registration, resolver); when the
 * variable is left unsupplied the indexer cannot read a value and costs each
 * one at its worst case, so the whole query is rejected:
 *
 *   Query complexity (78003) exceeds maximum allowed cost
 *
 * 100 matches the page the indexer applies by default, so this bounds the cost
 * without changing how many events come back — with `first` supplied the same
 * query costs a fraction of the limit and succeeds.
 */
export const NAME_HISTORY_PAGE_SIZE = 100

const getNameHistory = ResultFn(async function* (
  params: GetNameHistoryParameters,
) {
  const client = yield* safeGetClient()

  const events = yield* fromPromise(
    ensjs_getNameHistory(client, params),
    (e) =>
      new GetNameHistoryError({
        cause: e as GetSupportedInterfacesErrorType,
      }),
  )
  return ok(events)
})

const getNameHistoryQueryKey = createQueryKey<
  'get-name-history',
  GetNameHistoryParameters
>('get-name-history')

export const getNameHistoryQueryOptions = (params: GetNameHistoryParameters) =>
  resultQueryOptions({
    queryKey: getNameHistoryQueryKey(params),
    queryFn: () => getNameHistory(params),
  })
