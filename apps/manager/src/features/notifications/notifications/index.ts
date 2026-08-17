import {
  type NotificationDefinitions,
  notificationDefinitions,
} from '@ens-apps/shared-schema/notifications'
import type { FC } from 'react'
import { AlphaWelcomeComponent } from './alpha-welcome'
import { BlogPostComponent } from './blog-post'
import type { KindComponentProps, NotificationKind } from './contracts'
import { EnsUpdateComponent } from './ens-update'
import { NameExpiryComponent } from './name-expiry'
import { NameTransferredComponent } from './name-transferred'

/**
 * Single source of truth for manager-side notification kind behavior.
 */
export const NOTIFICATION_COMPONENT_REGISTRY = {
  'name-expiry': NameExpiryComponent,
  'name-transferred': NameTransferredComponent,
  'blog-post': BlogPostComponent,
  'alpha-welcome': AlphaWelcomeComponent,
  'ens-update': EnsUpdateComponent,
} as const satisfies { [K in NotificationKind]: FC<KindComponentProps<K>> }

export const getNotificationData = <K extends NotificationKind>(
  kind: K,
): {
  Component: (typeof NOTIFICATION_COMPONENT_REGISTRY)[K] | undefined
  definition: NotificationDefinitions[K] | undefined
} => {
  return {
    Component: NOTIFICATION_COMPONENT_REGISTRY[kind] ?? undefined,
    definition: notificationDefinitions[kind] ?? undefined,
  }
}

export default NOTIFICATION_COMPONENT_REGISTRY
