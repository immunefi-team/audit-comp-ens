import type { TelegramAuthData } from '@ens-apps/shared-schema/telegram'
import { $qk, qk } from '@ens-apps/utils/tanstack-query/queryKey'
import { mutationOptions, queryOptions } from '@tanstack/react-query'
import type { InferResponseType } from 'hono'
import { loginWithTelegramPopup } from '@/features/notifications/utils/telegram/auth'
import { backendClient } from '@/utils/backend-client'

// Types
export type Channel = InferResponseType<
  typeof backendClient.notifications.channels.$get,
  200
>[number]

// Queries
export const channelsQueryOptions = queryOptions({
  queryKey: qk('channels', 'list'),
  queryFn: async () => {
    const response = await backendClient.notifications.channels.$get()
    if (!response.ok) {
      throw new Error(`Failed to fetch channels: ${response.statusText}`)
    }
    return response.json()
  },
  refetchOnWindowFocus: true,
  staleTime: 0,
  refetchInterval: (query) => {
    const hasPendingChannel = query.state.data?.some(
      (channel) => channel.status === 'pending',
    )

    return hasPendingChannel ? 5_000 : false
  },
  meta: {
    dependsOn: ['backend'],
  },
})

export const channelQueryOptions = (channelId: string) =>
  queryOptions({
    queryKey: qk('channels', 'channel', {
      channelId,
    }),
    queryFn: async () => {
      const response = await backendClient.notifications.channels[':id'].$get({
        param: { id: channelId },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch channel: ${response.statusText}`)
      }

      return response.json()
    },
    meta: {
      dependsOn: ['backend'],
    },
  })

// Mutations
export const addEmailChannelMutationOptions = mutationOptions({
  mutationFn: async ({ email }: { email: string }) => {
    const response = await backendClient.notifications.channels.email.$post({
      json: { email },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        'error' in error ? error.error : 'Failed to add email channel',
      )
    }

    return response.json()
  },
  meta: {
    invalidates: [
      $qk({
        $scope: 'channels',
      }),
    ],
  },
})

export const telegramAuthMutationOptions = mutationOptions({
  mutationFn: async (): Promise<TelegramAuthData> => {
    return await loginWithTelegramPopup({
      requestAccess: 'write',
    })
  },
})

export const addTelegramChannelMutationOptions = mutationOptions({
  mutationFn: async ({ auth_data }: { auth_data: TelegramAuthData }) => {
    const response = await backendClient.notifications.channels.telegram.$post({
      json: { auth_data },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        'error' in error ? error.error : 'Failed to add Telegram channel',
      )
    }

    return response.json()
  },
  meta: {
    invalidates: [
      $qk({
        $scope: 'channels',
      }),
    ],
  },
})

export const deleteChannelMutationOptions = mutationOptions({
  mutationFn: async (channelId: string) => {
    const response = await backendClient.notifications.channels[':id'].$delete({
      param: { id: channelId },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        'error' in error ? error.error : 'Failed to delete channel',
      )
    }

    return response.json()
  },
  meta: {
    invalidates: [qk('channels', 'list'), qk('preferences', 'list')],
  },
})

export const testChannelMutationOptions = mutationOptions({
  mutationFn: async (channelId: string) => {
    const response = await backendClient.notifications.channels[
      ':id'
    ].test.$post({
      param: { id: channelId },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        'error' in error ? error.error : 'Failed to send test notification',
      )
    }

    return response.json()
  },
})

export const resendVerificationMutationOptions = mutationOptions({
  mutationFn: async (channelId: string) => {
    const response = await backendClient.notifications.channels[
      ':id'
    ].resend.$post({
      param: { id: channelId },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        'error' in error ? error.error : 'Failed to resend verification',
      )
    }

    return response.json()
  },
  meta: {
    invalidates: [qk('channels', 'list')],
  },
})

export const verifyEmailMutationOptions = mutationOptions({
  mutationFn: async (token: string) => {
    const response =
      await backendClient.notifications.channels.email.verify.$post({
        json: { token },
      })

    if (!response.ok) {
      const error = await response.json()
      throw new Error('error' in error ? error.error : 'Verification failed')
    }

    return response.json()
  },
  mutationKey: qk('channels', 'verify_email'),
  meta: {
    invalidates: [qk('channels', 'list')],
  },
})
