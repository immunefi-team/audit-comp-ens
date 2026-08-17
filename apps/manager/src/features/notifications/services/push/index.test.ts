import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
} from './index'

function createMockSubscription(overrides?: {
  endpoint?: string
  auth?: string | null
  p256dh?: string | null
}) {
  const endpoint = overrides?.endpoint ?? 'https://push.example.com/sub/123'
  const auth =
    overrides && 'auth' in overrides ? overrides.auth : 'auth-key-base64'
  const p256dh =
    overrides && 'p256dh' in overrides ? overrides.p256dh : 'p256dh-key-base64'

  return {
    endpoint,
    toJSON: () => ({
      endpoint,
      expirationTime: null,
      keys: { auth, p256dh },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription
}

function stubPushEnvironment(options?: {
  permission?: NotificationPermission
  requestPermission?: NotificationPermission
  subscription?: PushSubscription | null
  registerFn?: ReturnType<typeof vi.fn>
  subscribeFn?: ReturnType<typeof vi.fn>
}) {
  const permission = options?.permission ?? 'granted'
  const requestResult = options?.requestPermission ?? permission
  const subscription = options?.subscription ?? null

  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', {
    permission,
    requestPermission: vi.fn().mockResolvedValue(requestResult),
  })

  const mockRegistration = {
    pushManager: {
      subscribe:
        options?.subscribeFn ?? vi.fn().mockResolvedValue(subscription),
      getSubscription: vi.fn().mockResolvedValue(subscription),
    },
  }

  const registerFn =
    options?.registerFn ?? vi.fn().mockResolvedValue(mockRegistration)

  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: registerFn,
      ready: Promise.resolve(mockRegistration),
    },
    configurable: true,
  })

  return { registerFn }
}

describe('push notification service', () => {
  const originalNavigator = { ...navigator }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  describe('support + permission', () => {
    it('returns true when all required APIs are available', () => {
      stubPushEnvironment()
      expect(isPushSupported()).toBe(true)
    })

    it('returns error when Notification is unavailable', () => {
      const originalNotification = globalThis.Notification
      Object.defineProperty(globalThis, 'Notification', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const result = getPermissionStateResult()
      expect(result.isErr()).toBe(true)

      globalThis.Notification = originalNotification
    })

    it('requests notification permission', async () => {
      stubPushEnvironment({ requestPermission: 'granted' })
      const result = await requestNotificationPermissionResult()
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBe('granted')
    })

    it('returns denied when permission request is denied', async () => {
      stubPushEnvironment({ requestPermission: 'denied' })
      const result = await requestNotificationPermissionResult()
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBe('denied')
    })

    it('returns error when push is unsupported for permission request', async () => {
      const nav = { ...navigator }
      delete (nav as { serviceWorker?: unknown }).serviceWorker
      Object.defineProperty(globalThis, 'navigator', {
        value: nav,
        writable: true,
        configurable: true,
      })

      const result = await requestNotificationPermissionResult()
      expect(result.isErr()).toBe(true)
    })
  })

  describe('service worker + subscription', () => {
    it('registers push service worker', async () => {
      const { registerFn } = stubPushEnvironment()
      const result = await registerServiceWorkerResult()

      expect(result.isOk()).toBe(true)
      expect(registerFn).toHaveBeenCalledWith('/push-sw.js', { scope: '/' })
    })

    it('returns error on failed service worker registration', async () => {
      stubPushEnvironment({
        registerFn: vi.fn().mockRejectedValue(new Error('registration failed')),
      })
      const result = await registerServiceWorkerResult()
      expect(result.isErr()).toBe(true)
    })

    it('returns error on unsupported service worker registration', async () => {
      const nav = { ...navigator }
      delete (nav as { serviceWorker?: unknown }).serviceWorker
      Object.defineProperty(globalThis, 'navigator', {
        value: nav,
        writable: true,
        configurable: true,
      })

      const result = await registerServiceWorkerResult()
      expect(result.isErr()).toBe(true)
    })

    it('returns existing subscription when available', async () => {
      const subscription = createMockSubscription()
      stubPushEnvironment({ subscription })

      const result = await getExistingSubscriptionResult()
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBe(subscription)
    })

    it('returns null subscription when none exists', async () => {
      stubPushEnvironment({ subscription: null })
      const result = await getExistingSubscriptionResult()
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBeNull()
    })

    it('creates a push subscription from vapid key', async () => {
      const subscription = createMockSubscription()
      const subscribeFn = vi.fn().mockResolvedValue(subscription)

      stubPushEnvironment({
        subscription,
        subscribeFn,
      })

      const result = await createPushSubscriptionResult('dGVzdA')
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBe(subscription)
      expect(subscribeFn).toHaveBeenCalledOnce()
    })

    it('returns error when subscribe throws', async () => {
      stubPushEnvironment({
        subscribeFn: vi.fn().mockRejectedValue(new Error('subscribe failed')),
      })

      const result = await createPushSubscriptionResult('dGVzdA')
      expect(result.isErr()).toBe(true)
    })

    it('unsubscribes local browser subscription', async () => {
      const subscription = createMockSubscription()
      stubPushEnvironment({ subscription })

      const result = await unsubscribeLocalPushSubscriptionResult()
      expect(result.isOk()).toBe(true)
      expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    })

    it('returns ok when local subscription does not exist', async () => {
      stubPushEnvironment({ subscription: null })
      const result = await unsubscribeLocalPushSubscriptionResult()
      expect(result.isOk()).toBe(true)
    })

    it('returns error when unsubscribe fails', async () => {
      const subscription = {
        ...createMockSubscription(),
        unsubscribe: vi.fn().mockRejectedValue(new Error('unsubscribe failed')),
      } as unknown as PushSubscription
      stubPushEnvironment({ subscription })

      const result = await unsubscribeLocalPushSubscriptionResult()
      expect(result.isErr()).toBe(true)
    })
  })

  describe('serialization + hashing', () => {
    it('extracts valid PushSubscriptionJSON payload', () => {
      const subscription = createMockSubscription()
      const result = getSubscriptionJsonResult(subscription)
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual({
        endpoint: 'https://push.example.com/sub/123',
        expirationTime: null,
        keys: {
          auth: 'auth-key-base64',
          p256dh: 'p256dh-key-base64',
        },
      })
    })

    it('returns error for invalid PushSubscriptionJSON payload', () => {
      const subscription = createMockSubscription({ auth: null, p256dh: null })
      const result = getSubscriptionJsonResult(subscription)
      expect(result.isErr()).toBe(true)
    })

    it('hashes endpoint with sha256 hex', async () => {
      const result = await hashSubscriptionEndpointResult(
        'https://push.example.com/sub/123',
      )
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBe(
        'c1858014ce0f52b202f1c8e38d6f0220c7de57d0ee157b8da1d9c08ca4a253a6',
      )
    })
  })
})
