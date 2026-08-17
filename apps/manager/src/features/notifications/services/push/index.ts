import { fromSync, ResultFn, TaggedError } from '@ens-apps/utils/neverthrow'
import { fromPromise, ok } from 'neverthrow'
import type { PushSubscriptionJSON } from '@/features/notifications/types/push'

const SERVICE_WORKER_PATH = '/push-sw.js'

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

export class PushNotSupportedError extends TaggedError(
  'PushNotSupportedError',
)<{
  cause?: unknown
}> {}

export class ServiceWorkerRegistrationError extends TaggedError(
  'ServiceWorkerRegistrationError',
)<{
  cause: unknown
}> {}

export class PushPermissionRequestError extends TaggedError(
  'PushPermissionRequestError',
)<{
  cause: unknown
}> {}

export class PushSubscriptionError extends TaggedError(
  'PushSubscriptionError',
)<{
  cause: unknown
}> {}

export class PushSubscriptionInvalidError extends TaggedError(
  'PushSubscriptionInvalidError',
)<{
  cause?: unknown
}> {}

export class PushHashEndpointError extends TaggedError(
  'PushHashEndpointError',
)<{
  cause: unknown
}> {}

const ensurePushSupported = () =>
  isPushSupported()
    ? ok(undefined)
    : new PushNotSupportedError({
        cause: new Error(
          'Push notifications are not supported in this browser',
        ),
      }).toErr()

const urlBase64ToUint8Array = (base64String: string) =>
  fromSync(
    () => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
      const base64 = (base64String + padding)
        .replaceAll('-', '+')
        .replaceAll('_', '/')
      const rawData = window.atob(base64)
      const outputArray = new Uint8Array(rawData.length)

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
      }

      return outputArray
    },
    (cause) => new PushSubscriptionError({ cause }),
  )

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    'crypto' in globalThis &&
    'subtle' in crypto
  )
}

export const getPermissionStateResult = ResultFn(function* () {
  yield* ensurePushSupported()
  return ok(Notification.permission)
})

export const requestNotificationPermissionResult = ResultFn(async function* () {
  yield* ensurePushSupported()

  const permission = yield* fromPromise(
    Notification.requestPermission(),
    (cause) => new PushPermissionRequestError({ cause }),
  )

  return ok(permission)
})

export const registerServiceWorkerResult = ResultFn(async function* () {
  yield* ensurePushSupported()

  const registration = yield* fromPromise(
    navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: '/' }),
    (cause) => new ServiceWorkerRegistrationError({ cause }),
  )

  yield* fromPromise(navigator.serviceWorker.ready, (cause) => {
    return new ServiceWorkerRegistrationError({ cause })
  })

  return ok(registration)
})

export const getExistingSubscriptionResult = ResultFn(async function* () {
  yield* ensurePushSupported()

  const registration = yield* fromPromise(
    navigator.serviceWorker.ready,
    (cause) => new PushSubscriptionError({ cause }),
  )

  const subscription = yield* fromPromise(
    registration.pushManager.getSubscription(),
    (cause) => new PushSubscriptionError({ cause }),
  )

  return ok(subscription)
})

export const createPushSubscriptionResult = ResultFn(async function* (
  vapidPublicKey: string,
) {
  yield* ensurePushSupported()

  const key = yield* urlBase64ToUint8Array(vapidPublicKey)
  const registration = yield* fromPromise(
    navigator.serviceWorker.ready,
    (cause) => new PushSubscriptionError({ cause }),
  )

  const subscription = yield* fromPromise(
    Promise.race([
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }),
      // Add a timeout for the subscription request for browser that don't properly support the push API
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'PushManager.subscribe did not return within timeout period',
              ),
            ),
          15_000, // 15 seconds
        ),
      ),
    ]),
    (cause) => new PushSubscriptionError({ cause }),
  )

  return ok(subscription)
})

export const unsubscribeLocalPushSubscriptionResult = ResultFn(async function* (
  subscription?: PushSubscription | null,
) {
  const activeSubscription =
    subscription ?? (yield* getExistingSubscriptionResult())

  if (!activeSubscription) {
    return ok(undefined)
  }

  yield* fromPromise(activeSubscription.unsubscribe(), (cause) => {
    return new PushSubscriptionError({ cause })
  })

  return ok(undefined)
})

export const hashSubscriptionEndpointResult = ResultFn(async function* (
  endpoint: string,
) {
  const encoded = new TextEncoder().encode(endpoint)
  const digest = yield* fromPromise(
    crypto.subtle.digest('SHA-256', encoded),
    (cause) => new PushHashEndpointError({ cause }),
  )

  return ok(bytesToHex(new Uint8Array(digest)))
})

export const getSubscriptionJsonResult = ResultFn(function* (
  subscription: PushSubscription,
) {
  const subscriptionJson = subscription.toJSON()
  const endpoint = subscriptionJson.endpoint
  const auth = subscriptionJson.keys?.auth
  const p256dh = subscriptionJson.keys?.p256dh

  if (!endpoint || !auth || !p256dh) {
    return yield* new PushSubscriptionInvalidError({
      message: 'Invalid push subscription payload',
    })
  }

  return ok({
    endpoint: endpoint,
    expirationTime: subscriptionJson.expirationTime ?? null,
    keys: {
      auth: auth,
      p256dh: p256dh,
    },
  } satisfies PushSubscriptionJSON)
})
