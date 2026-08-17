import * as v from 'valibot'

export const expiryStageIdSchema = v.picklist(['30d', '7d', '1d', 'expired'])
export type ExpiryStageId = v.InferOutput<typeof expiryStageIdSchema>

export const expiryEventSchema = v.object({
  type: v.literal('name_expiring'),
  name: v.string(),
  expiryDate: v.number(),
  stage: expiryStageIdSchema,
  owner: v.optional(v.string()),
  includeFavorites: v.boolean(),
})

export type ExpiryEvent = v.InferOutput<typeof expiryEventSchema>
