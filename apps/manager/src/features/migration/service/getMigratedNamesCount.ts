import type {
  MigratedNamesCountQuery,
  MigratedNamesCountQueryVariables,
} from '@ens-apps/indexer'
import { MigratedNamesCountDocument } from '@ens-apps/indexer'
import indexerClient from '@ens-apps/indexer/urql'
import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { skipToken } from '@tanstack/react-query'
import { ok, ResultAsync } from 'neverthrow'

class GetMigratedNamesCountError extends TaggedError(
  'GetMigratedNamesCountError',
)<{
  cause: unknown
}> {}

export const getMigratedNamesCount = ResultFn(async function* (
  address: string,
) {
  const variables = {
    where: {
      owner: address.toLowerCase(),
      isMigrated: true,
    },
  } as unknown as MigratedNamesCountQueryVariables

  const data = yield* await ResultAsync.fromPromise(
    indexerClient
      .query<MigratedNamesCountQuery, MigratedNamesCountQueryVariables>(
        MigratedNamesCountDocument,
        variables,
      )
      .toPromise()
      .then((result) => {
        if (result.error) throw result.error
        if (!result.data) throw new Error('Indexer query returned no data')
        return result.data
      }),
    (error) => new GetMigratedNamesCountError({ cause: error }),
  )

  return ok(data.domainConnection.totalCount ?? 0)
})

export const migratedNamesCountQueryOptions = (
  address?: string,
  enabled: boolean = true,
) =>
  resultQueryOptions({
    queryKey: qk('migration', 'migrated_names_count', {
      address: address?.toLowerCase(),
    }),
    queryFn:
      enabled && address
        ? () => getMigratedNamesCount(address.toLowerCase())
        : skipToken,
    meta: {
      dependsOn: ['indexer'],
    },
  })
