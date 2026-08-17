import { $qk, qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { mutationOptions, queryOptions } from '@tanstack/react-query'
import type { InferRequestType } from 'hono/client'
import { backendClient } from '@/utils/backend-client'

// Queries
export const preferencesQueryOptions = queryOptions({
  queryKey: qk('preferences', 'list'),
  queryFn: async () => {
    const response = await backendClient.notifications.preferences.$get()
    if (!response.ok) {
      throw new Error(`Failed to fetch preferences: ${response.statusText}`)
    }
    return response.json()
  },
  meta: {
    dependsOn: ['backend'],
  },
})

// Mutations
export const updatePreferenceMutationOptions = mutationOptions({
  mutationFn: async (
    request: InferRequestType<
      typeof backendClient.notifications.preferences.$patch
    >['json'],
  ) => {
    const response = await backendClient.notifications.preferences.$patch({
      json: request,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        'error' in error ? error.error : 'Failed to update preference',
      )
    }

    return response.json()
  },
  meta: {
    invalidates: [
      $qk({
        $scope: 'preferences',
      }),
    ],
  },
})
