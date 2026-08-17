import {
  DomainsDocument,
  type DomainsQuery,
  type DomainsQueryVariables,
} from '@ens-apps/indexer'
import indexerClient from '@ens-apps/indexer/urql'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { skipToken } from '@tanstack/react-query'
import { ok, ResultAsync } from 'neverthrow'

export class GetDomainsError extends TaggedError('GetDomainsError')<{
  cause: unknown
}> {}

export const getDomains = ResultFn(async function* (
  variables: DomainsQueryVariables,
) {
  const data = yield* await ResultAsync.fromPromise(
    indexerClient
      .query<DomainsQuery, DomainsQueryVariables>(DomainsDocument, variables)
      .toPromise()
      .then((result) => {
        if (result.error) throw result.error
        if (!result.data) throw new Error('Indexer query returned no data')
        return result.data
      }),
    (error) => new GetDomainsError({ cause: error }),
  )

  return ok(data)
})

export const getDomainsQuery = (variables: DomainsQueryVariables | undefined) =>
  resultQueryOptions({
    queryKey: qk('dashboard', 'domains', variables ?? {}),
    queryFn: variables ? () => getDomains(variables) : skipToken,
  })
