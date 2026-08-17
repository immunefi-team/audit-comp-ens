import * as v from 'valibot'

export const channelDefinitions = {
  email: {
    label: 'Email',
    requiresVerification: true,
    dataSchema: v.null(),
  },
  telegram: {
    label: 'Telegram',
    requiresVerification: true,
    dataSchema: v.object({
      username: v.string(),
    }),
  },
  push: {
    label: 'Push Notification',
    requiresVerification: true,
    dataSchema: v.object({
      auth: v.string(),
      p256dh: v.string(),
      expirationTime: v.optional(v.nullable(v.number())),
    }),
  },
} as const satisfies Record<
  string,
  {
    label: string
    requiresVerification: boolean
    dataSchema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
  }
>

export type ChannelType = keyof typeof channelDefinitions
