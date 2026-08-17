import { mutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { backendClient } from '@/utils/backend-client'
import {
  type FavoriteEntry,
  favoritesQueryOptions,
} from '../queries/getFavorites'
import { showFavoriteAddedToast } from './favoriteToast'

export const addFavoriteMutationOptions = mutationOptions({
  mutationKey: [
    {
      $service: 'backend',
      $scope: 'favorites',
      $action: 'add',
    },
  ],
  mutationFn: async ({ name }: { name: string }) => {
    const response = await backendClient.favorites[':name'].$put({
      param: { name },
    })

    if (!response.ok) {
      throw new Error('Failed to add favorite')
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
    const exists = previousFavorites?.some(
      (entry) => entry.name.toLowerCase() === name.toLowerCase(),
    )

    // No need to update the query data if it's already in the list
    if (exists) {
      return { previousFavorites, wasCacheUpdated: false }
    }

    client.setQueryData<readonly FavoriteEntry[]>(
      favoritesQueryOptions.queryKey,
      (old) => [...(old ?? []), { name, created_at: new Date().toISOString() }],
    )

    return { previousFavorites, wasCacheUpdated: true }
  },
  onError: (err, variables, onMutateResult, { client }) => {
    if (onMutateResult?.previousFavorites) {
      client.setQueryData(
        favoritesQueryOptions.queryKey,
        onMutateResult?.previousFavorites,
      )
    } else {
      // previousFavorites is undefined if the query failed (for example, if the user is not logged in)
      // so we need to reset the query to get the initial data
      client.resetQueries({ queryKey: favoritesQueryOptions.queryKey })
    }

    toast.error(`Failed to add ${variables.name} to favorites`, {
      description: 'See console for more details',
    })
    console.error(`Failed to add ${variables.name} to favorites`, err)
  },
  onSuccess: (_data, _variables, onMutateResult) => {
    if (!onMutateResult?.wasCacheUpdated) return

    showFavoriteAddedToast()
  },
  onSettled: (_data, _error, _variables, onMutateResult, { client }) => {
    // Don't invalidate if no changes were made
    if (!onMutateResult?.wasCacheUpdated) return

    client.invalidateQueries({ queryKey: favoritesQueryOptions.queryKey })
  },
})
