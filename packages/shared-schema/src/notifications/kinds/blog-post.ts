import * as v from 'valibot'
import { safeHttpUrlSchema } from '../../safe-http-url'
import type { NotificationDefinition } from '../types'

export const blogPostDefinition = {
  kind: 'blog-post',
  source: 'broadcast',
  payloadSchema: v.object({
    title: v.string(),
    url: safeHttpUrlSchema(),
    imageUrl: safeHttpUrlSchema(),
  }),
  metadata: {
    category: 'ENS Updates',
    label: 'Blog Post',
    description: 'Get notified when a new blog post is published',
    priority: 'low',
    recommended: false,
    tags: ['education', 'updates'],
  },
  delivery: {
    mode: 'none',
  },
} as const satisfies NotificationDefinition
