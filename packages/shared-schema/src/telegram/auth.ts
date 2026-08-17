import * as v from 'valibot'

export const TelegramAuthSchema = v.object({
  id: v.number(),
  first_name: v.optional(v.string()),
  last_name: v.optional(v.string()),
  username: v.string(),
  photo_url: v.optional(v.string()),
  auth_date: v.pipe(
    v.number(),
    v.description('Unix timestamp in seconds since epoch'),
  ),
  hash: v.string(),
})

export type TelegramAuthData = v.InferOutput<typeof TelegramAuthSchema>
