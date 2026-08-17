/**
 * Push notification types for browser-side implementation.
 */

export type PushSubscriptionState = {
  /**
   * Whether push notifications are supported in this browser.
   */
  readonly isSupported: boolean

  /**
   * Whether the service worker is registered and ready.
   */
  readonly isReady: boolean

  /**
   * Current permission state.
   */
  readonly permission: NotificationPermission

  /**
   * Whether user has an active push subscription.
   */
  readonly isSubscribed: boolean

  /**
   * The current push subscription, if any.
   */
  readonly subscription: PushSubscription | null

  /**
   * Error message if something went wrong.
   */
  readonly error: string | null
}

export type PushSubscriptionJSON = {
  endpoint: string
  expirationTime: number | null
  keys: {
    auth: string
    p256dh: string
  }
}
