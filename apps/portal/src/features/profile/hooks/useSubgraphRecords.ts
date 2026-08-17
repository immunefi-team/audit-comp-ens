import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import {
  getSubgraphRecords as ensjs_getSubgraphRecords,
  type GetSubgraphRecordsErrorType,
} from '@ensdomains/ensjs/subgraph'
import { fromPromise, ok } from 'neverthrow'
import { safeGetClient } from '@/lib/wagmi/helpers'

class GetSubgraphRecordsError extends TaggedError('GetSubgraphRecordsError')<{
  cause: GetSubgraphRecordsErrorType
}> {}

export const getSubgraphRecords = ResultFn(async function* (name: string) {
  const client = yield* safeGetClient()

  const subgraphRecords = yield* fromPromise(
    ensjs_getSubgraphRecords(client, { name }),
    (e) =>
      new GetSubgraphRecordsError({ cause: e as GetSubgraphRecordsErrorType }),
  )

  return ok(subgraphRecords)
})
