import * as v from 'valibot'
import type { NotificationDefinition } from '../types'

export const nameExpiryDefinition = {
  kind: 'name-expiry',
  source: 'personal',
  payloadSchema: v.object({
    name: v.string(),
    expiryDate: v.number(),
    isOwner: v.boolean(),
    watchReason: v.picklist(['owned', 'favourited', 'manual']),
  }),
  metadata: {
    category: 'Domain Lifecycle',
    label: 'Name Expiry',
    description: 'Get notified when your domains are about to expire',
    priority: 'high',
    recommended: true,
    thresholds: [30, 7, 1],
    tags: ['expiry'],
  },
  delivery: {
    mode: 'opt-in',
    channels: ['email', 'telegram', 'push'],
    preferenceKey: 'watchBasedNameExpiry',
  },
} as const satisfies NotificationDefinition
