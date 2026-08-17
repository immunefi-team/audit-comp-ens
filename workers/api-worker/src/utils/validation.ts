import { ok } from 'neverthrow'
import * as v from 'valibot'
import { error, type GenericError } from './result'
export const coerceNumber = v.pipe(
  v.union([v.string(), v.number()]),
  v.transform((val) => Number(val)),
)

export const coerceBoolean = v.pipe(
  v.union([v.string(), v.boolean()]),
  v.transform((val) => val === 'true' || val === true),
)

export const hex = v.custom<`0x${string}`>((input) =>
  typeof input === 'string' ? /^0x[0-9a-fA-F]+$/.test(input) : false,
)

export const ethAddress = v.custom<`0x${string}`>((input) =>
  typeof input === 'string' ? /^0x[0-9a-fA-F]{40}$/.test(input) : false,
)

export const parseIntoResult = <
  const TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  const TBaseError extends GenericError,
>(
  schema: TSchema,
  input: unknown,
  baseError: TBaseError = {
    code: 'INVALID_INPUT',
    message: 'Invalid input',
  } as TBaseError,
) => {
  const parseResult = v.safeParse(schema, input)
  if (!parseResult.success) {
    return error({
      ...baseError,
      issues: parseResult.issues,
      output: parseResult.output,
    })
  }
  return ok(parseResult.output)
}
