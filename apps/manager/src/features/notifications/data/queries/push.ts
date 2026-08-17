import { ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import {
  resultMutationOptions,
  resultQueryOptions,
} from '@ens-apps/utils/tanstack-query/neverthrow'
import { qk } from '@ens-apps/utils/tanstack-query/queryKey'
import type { QueryClient } from '@tanstack/react-query'
import type { ClientResponse } from 'hono/client'
import { fromPromise, ok } from 'neverthrow'
import type { Channel } from '@/features/notifications/data/queries/channels'
import { channelsQueryOptions } from '@/features/notifications/data/queries/channels'
import {
  createPushSubscriptionResult,
  getExistingSubscriptionResult,
  getPermissionStateResult,
  getSubscriptionJsonResult,
  hashSubscriptionEndpointResult,
  isPushSupported,
  registerServiceWorkerResult,
  requestNotificationPermissionResult,
  unsubscribeLocalPushSubscriptionResult,
} from '@/features/notifications/services/push'
import { backendClient } from '@/utils/backend-client'

export type BrowserPushState = {
  isSupported: boolean
  permission: NotificationPermission
  endpointHash: string | null
}

class PushChannelRequestError extends TaggedError('PushChannelRequestError')<{
  cause: unknown
}> {}

class PushPermissionDeniedError extends TaggedError(
  'PushPermissionDeniedError',
) {}

export class ChannelNotFoundForEndpointError extends TaggedError(
  'ChannelNotFoundForEndpointError',
)<{
  endpointHash: string
}> {}

const parseJsonResult = ResultFn(async function* <T>(
  response: ClientResponse<T>,
) {
  const data = yield* fromPromise(
    response.json() as Promise<T>,
    (cause) => new PushChannelRequestError({ cause }),
  )

  return ok(data)
})

const browserPushStateQuery = ResultFn(async function* () {
  if (!isPushSupported()) {
    return ok({
      isSupported: false,
      permission: 'denied',
      endpointHash: null,
    } satisfies BrowserPushState)
  }

  const permission = yield* getPermissionStateResult()
  if (permission !== 'granted') {
    return ok({
      isSupported: true,
      permission,
      endpointHash: null,
    } satisfies BrowserPushState)
  }

  const registrationResult = await registerServiceWorkerResult()
  if (registrationResult.isErr()) {
    return ok({
      isSupported: false,
      permission,
      endpointHash: null,
    } satisfies BrowserPushState)
  }

  const subscription = yield* getExistingSubscriptionResult()
  if (!subscription?.endpoint) {
    return ok({
      isSupported: true,
      permission,
      endpointHash: null,
    } satisfies BrowserPushState)
  }

  const endpointHash = yield* hashSubscriptionEndpointResult(
    subscription.endpoint,
  )
  return ok({
    isSupported: true,
    permission,
    endpointHash,
  } satisfies BrowserPushState)
})

const getVapidPublicKeyResult = ResultFn(async function* () {
  const response = yield* fromPromise(
    backendClient.notifications.channels.push['vapid-public-key'].$get(),
    (cause) => new PushChannelRequestError({ cause }),
  )

  if (!response.ok) {
    return yield* new PushChannelRequestError({
      cause: new Error(`Failed to fetch VAPID public key: ${response.status}`),
    })
  }

  const data = yield* parseJsonResult<{ publicKey: string }>(response)

  return ok(data.publicKey)
})

const addPushChannelResult = ResultFn(async function* (subscription: {
  endpoint: string
  expirationTime: number | null
  keys: { auth: string; p256dh: string }
}) {
  const response = yield* fromPromise(
    backendClient.notifications.channels.push.$post({
      json: subscription,
    }),
    (cause) => new PushChannelRequestError({ cause }),
  )

  if (!response.ok) {
    return yield* new PushChannelRequestError({
      cause: new Error(`Failed to add push channel: ${response.status}`),
    })
  }

  const data = yield* parseJsonResult<{ id: string }>(response)

  return ok(data)
})

const deletePushChannelResult = ResultFn(async function* (channelId: string) {
  const response = yield* fromPromise(
    backendClient.notifications.channels[':id'].$delete({
      param: { id: channelId },
    }),
    (cause) => new PushChannelRequestError({ cause }),
  )

  if (!response.ok) {
    return yield* new PushChannelRequestError({
      cause: new Error(`Failed to delete push channel: ${response.status}`),
    })
  }

  const data = yield* parseJsonResult(response)

  return ok(data)
})

const findMatchingPushChannel = (
  channels: Channel[],
  endpointHash: string,
): Channel | undefined => {
  return channels.find(
    (channel) =>
      channel.channel === 'push' &&
      'endpointHash' in channel &&
      channel.endpointHash === endpointHash,
  )
}

const enableBrowserPushResult = ResultFn(async function* () {
  yield* registerServiceWorkerResult()

  const permission = yield* requestNotificationPermissionResult()
  if (permission !== 'granted') {
    return yield* new PushPermissionDeniedError({
      message: 'Permission denied',
    })
  }

  const vapidPublicKey = yield* getVapidPublicKeyResult()
  const subscription = yield* createPushSubscriptionResult(vapidPublicKey)
  const subscriptionJson = yield* getSubscriptionJsonResult(subscription)
  const channelResult = await addPushChannelResult(subscriptionJson)
  if (channelResult.isErr()) {
    await unsubscribeLocalPushSubscriptionResult(subscription)
    return channelResult
  }
  const channel = channelResult.value
  return ok({ permission, channel })
})

const disableBrowserPushResult = ResultFn(async function* (
  queryClient: QueryClient,
) {
  const subscription = yield* getExistingSubscriptionResult()
  if (!subscription?.endpoint) {
    return ok({ removed: false as const })
  }

  const endpointHash = yield* hashSubscriptionEndpointResult(
    subscription.endpoint,
  )
  const channels = yield* fromPromise(
    queryClient.ensureQueryData(channelsQueryOptions),
    (cause) => new PushChannelRequestError({ cause }),
  )
  const matchedChannel = findMatchingPushChannel(channels, endpointHash)

  if (!matchedChannel) {
    return yield* new ChannelNotFoundForEndpointError({ endpointHash })
  }

  yield* deletePushChannelResult(matchedChannel.id)
  yield* unsubscribeLocalPushSubscriptionResult(subscription)

  return ok({ removed: true as const })
})

export const browserPushStateQueryOptions = resultQueryOptions({
  queryKey: qk('channels', 'push', { key: 'browser-state' }),
  queryFn: () => browserPushStateQuery(),
})

export const vapidPublicKeyQueryOptions = resultQueryOptions({
  queryKey: qk('channels', 'push', { key: 'vapid-public-key' }),
  queryFn: () => getVapidPublicKeyResult(),
  staleTime: Number.POSITIVE_INFINITY,
})

export const enableBrowserPushMutationOptions = resultMutationOptions({
  mutationKey: qk('channels', 'push', { key: 'enable' }),
  mutationFn: () => enableBrowserPushResult(),
  meta: {
    invalidates: [qk('channels', 'list')],
  },
})

export const disableBrowserPushMutationOptions = (queryClient: QueryClient) =>
  resultMutationOptions({
    mutationKey: qk('channels', 'push', { key: 'disable' }),
    mutationFn: () => disableBrowserPushResult(queryClient),
    meta: {
      invalidates: [qk('channels', 'list'), qk('preferences', 'list')],
    },
  })
