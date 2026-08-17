import { $qk, qk } from '@ens-apps/utils/tanstack-query/queryKey'
import {
  infiniteQueryOptions,
  mutationOptions,
  queryOptions,
} from '@tanstack/react-query'
import type { InferResponseType } from 'hono'
import { selectValidNotifications } from '@/features/notifications/data/selectors'
import { backendClient } from '@/utils/backend-client'

export type NotificationsResponse = InferResponseType<
  typeof backendClient.notifications.$get
>
export type BackendNotification = NotificationsResponse['notifications'][number]
export type NotificationIdentifier = Pick<BackendNotification, 'id' | 'source'>

export const notificationsInfiniteQuery = infiniteQueryOptions({
  queryKey: qk('notifications', 'infinite'),
  queryFn: async ({ pageParam }) => {
    const response = await backendClient.notifications.$get({
      query: {
        cursor: pageParam as string | undefined,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch notifications: ${response.statusText}`)
    }

    return response.json()
  },
  select: (data) =>
    selectValidNotifications(data.pages.flatMap((page) => page.notifications)),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  meta: {
    dependsOn: ['backend'],
  },
})

export const unreadCountQuery = queryOptions({
  queryKey: qk('notifications', 'unread-count'),
  queryFn: async () => {
    const response = await backendClient.notifications['unread-count'].$get()
    return response.json()
  },
  meta: {
    dependsOn: ['backend'],
  },
})

const READ_BATCH_SIZE = 100

const patchReadNotifications = async (
  notifications: NotificationIdentifier[],
) => {
  if (notifications.length === 0) return

  for (let i = 0; i < notifications.length; i += READ_BATCH_SIZE) {
    const response = await backendClient.notifications.read.$patch({
      json: notifications.slice(i, i + READ_BATCH_SIZE),
    })

    if (!response.ok) {
      throw new Error(
        `Failed to mark notifications as read: ${response.status}`,
      )
    }
  }
}

export const markNotificationsReadMutationOptions = mutationOptions({
  mutationFn: async (notifications: NotificationIdentifier[]) => {
    await patchReadNotifications(notifications)
    return { markedCount: notifications.length }
  },
  meta: {
    invalidates: [
      $qk({
        $scope: 'notifications',
      }),
    ],
  },
})

export const markAllNotificationsReadMutationOptions = mutationOptions({
  mutationFn: async (loadedNotifications: BackendNotification[]) => {
    const unread = loadedNotifications
      .filter((notification) => !notification.seen)
      .map(({ id, source }) => ({ id, source }))

    await patchReadNotifications(unread)
    return { markedCount: unread.length }
  },
  meta: {
    invalidates: [
      $qk({
        $scope: 'notifications',
      }),
    ],
  },
})
