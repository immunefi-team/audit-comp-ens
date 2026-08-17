import * as v from 'valibot'
import type { NotificationDefinition } from '../types'

export const nameTransferredDefinition = {
  kind: 'name-transferred',
  source: 'personal',
  payloadSchema: v.object({
    name: v.string(),
    txHash: v.string(),
    to: v.string(),
  }),
  metadata: {
    category: 'Domain Lifecycle',
    label: 'Name Transferred',
    description: 'Get notified when your domains are transferred',
    priority: 'medium',
    recommended: true,
    tags: ['transfer'],
  },
  delivery: {
    mode: 'opt-in',
    channels: ['email', 'telegram', 'push'],
  },
} as const satisfies NotificationDefinition
