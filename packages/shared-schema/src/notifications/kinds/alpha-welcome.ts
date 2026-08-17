import * as v from 'valibot'
import { optionalSafeHttpUrlSchema } from '../../safe-http-url'
import type { NotificationDefinition } from '../types'

export const alphaWelcomeDefinition = {
  kind: 'alpha-welcome',
  source: 'broadcast',
  payloadSchema: v.object({
    title: v.string(),
    body: v.string(),
    ctaLabel: v.optional(v.string()),
    ctaUrl: optionalSafeHttpUrlSchema(),
  }),
  metadata: {
    category: 'ENS Updates',
    label: 'Welcome',
    description: 'Welcome and onboarding notifications in alpha',
    priority: 'medium',
    recommended: false,
    tags: ['onboarding'],
  },
  delivery: {
    mode: 'none',
  },
} as const satisfies NotificationDefinition
