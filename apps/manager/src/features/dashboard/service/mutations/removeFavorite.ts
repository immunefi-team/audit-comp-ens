import { $qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { mutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { backendClient } from '@/utils/backend-client'
import {
  type FavoriteEntry,
  favoritesQueryOptions,
} from '../queries/getFavorites'

export const removeFavoriteMutationOptions = mutationOptions({
  mutationKey: $qk({
    $service: 'backend',
    $scope: 'favorites',
    $action: 'remove',
  }),
  mutationFn: async ({ name }: { name: string }) => {
    const response = await backendClient.favorites[':name'].$delete({
      param: { name },
    })

    if (!response.ok) {
      throw new Error('Failed to remove favorite')
    }

    return response.json()
  },
  onMutate: async ({ name }, { client }) => {
    await client.cancelQueries({
      queryKey: favoritesQueryOptions.queryKey,
    })

    const previousFavorites = client.getQueryData<readonly FavoriteEntry[]>(
      favoritesQueryOptions.queryKey,
    )

    client.setQueryData<readonly FavoriteEntry[]>(
      favoritesQueryOptions.queryKey,
      (old) =>
        (old ?? []).filter(
          (entry) => entry.name.toLowerCase() !== name.toLowerCase(),
        ),
    )

    return { previousFavorites }
  },
  onError: (err, variables, onMutateResult, { client }) => {
    if (onMutateResult?.previousFavorites) {
      client.setQueryData(
        favoritesQueryOptions.queryKey,
        onMutateResult.previousFavorites,
      )
    }

    toast.error(`Failed to remove ${variables.name} from favorites`, {
      description: 'See console for more details',
    })
    console.error(`Failed to remove ${variables.name} from favorites`, err)
  },
  onSettled: (_data, _error, _variables, _result, { client }) => {
    client.invalidateQueries({ queryKey: favoritesQueryOptions.queryKey })
  },
})
