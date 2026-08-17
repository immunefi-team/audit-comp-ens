import type { NotificationDefinition } from '../types'
import { alphaWelcomeDefinition } from './alpha-welcome'
import { blogPostDefinition } from './blog-post'
import { ensUpdateDefinition } from './ens-update'
import { nameExpiryDefinition } from './name-expiry'
import { nameTransferredDefinition } from './name-transferred'

export const notificationDefinitions = {
  'name-expiry': nameExpiryDefinition,
  'name-transferred': nameTransferredDefinition,
  'blog-post': blogPostDefinition,
  'alpha-welcome': alphaWelcomeDefinition,
  'ens-update': ensUpdateDefinition,
} as const satisfies Record<string, NotificationDefinition>

export type NotificationDefinitions = typeof notificationDefinitions
