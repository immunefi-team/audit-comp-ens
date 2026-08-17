import * as v from 'valibot'
import { createSafeUrlSchema } from './safeUrl'

const urlSchema = createSafeUrlSchema(
  'Enter a valid URL (e.g. https://example.com)',
)

const emailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.email('Enter a valid email address'),
)

const validate = (
  schema: v.GenericSchema<string>,
  value: string | undefined,
): string | undefined => {
  if (!value || value.trim() === '') return undefined

  const result = v.safeParse(schema, value)

  if (!result.success) {
    return result.issues[0]?.message
  }

  return undefined
}

export const validateUrl = (value: string | undefined) =>
  validate(urlSchema, value)

export const validateEmail = (value: string | undefined) =>
  validate(emailSchema, value)
