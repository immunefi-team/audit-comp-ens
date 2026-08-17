import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { resultQueryOptions } from '@ens-apps/utils/tanstack-query/neverthrow'
import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { ok, ResultAsync } from 'neverthrow'
import { backendClient } from '@/utils/backend-client'

export type FavoriteEntry = {
  readonly name: string
  readonly created_at: string
}

export class GetFavoritesError extends TaggedError('GetFavoritesError')<{
  cause: unknown
}> {}

export const getFavorites = ResultFn(async function* () {
  const data = yield* await ResultAsync.fromPromise(
    backendClient.favorites.$get().then((response) => {
      if (!response.ok)
        throw new Error(`Failed to fetch favorites: ${response.statusText}`)
      return response.json()
    }),
    (error) => new GetFavoritesError({ cause: error }),
  )

  return ok(data as readonly FavoriteEntry[])
})

export const favoritesQueryOptions = resultQueryOptions({
  queryKey: $qk({
    $service: 'backend',
    $scope: 'favorites',
    $action: 'list',
  }),
  queryFn: () => getFavorites(),
  placeholderData: [],
  meta: {
    dependsOn: ['backend'],
  },
})
