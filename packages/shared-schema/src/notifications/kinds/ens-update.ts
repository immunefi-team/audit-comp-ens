import * as v from 'valibot'
import { optionalSafeHttpUrlSchema } from '../../safe-http-url'
import type { NotificationDefinition } from '../types'

export const ensUpdateDefinition = {
  kind: 'ens-update',
  source: 'broadcast',
  payloadSchema: v.object({
    title: v.string(),
    summary: v.string(),
    url: optionalSafeHttpUrlSchema(),
  }),
  metadata: {
    category: 'ENS Updates',
    label: 'ENS Update',
    description: 'Protocol and product updates in dashboard notifications',
    priority: 'medium',
    recommended: true,
    tags: ['updates'],
  },
  delivery: {
    mode: 'none',
  },
} as const satisfies NotificationDefinition
