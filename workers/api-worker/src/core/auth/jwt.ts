import { TaggedError } from '@ens-apps/utils/neverthrow'
import { sign, verify } from 'hono/jwt'
import { err, fromAsyncThrowable, ok } from 'neverthrow'
import * as v from 'valibot'

const JWT_EXPIRATION = 60 * 60 * 24 * 7 // 7 days

export const AuthPayload = v.object({
  user_id: v.string(),
  address: v.string(),
})

export type AuthPayload = v.InferOutput<typeof AuthPayload>

class SignJWTError extends TaggedError('SIGN_JWT_ERROR') {}

class VerifyJWTError extends TaggedError('VERIFY_JWT_ERROR') {}

class InvalidJWTPayloadError extends TaggedError('INVALID_JWT_PAYLOAD_ERROR')<{
  issues: v.GenericIssue[]
}> {}

export const safeSign = fromAsyncThrowable(
  sign,
  (err) =>
    new SignJWTError({
      message: err instanceof Error ? err.message : 'JWT signing failed',
      cause: err,
    }),
)

export const safeVerify = fromAsyncThrowable(
  verify,
  (err) =>
    new VerifyJWTError({
      message: err instanceof Error ? err.message : 'JWT verification failed',
      cause: err,
    }),
)

export const signJWT = (
  payload: Record<string, unknown>,
  env: CloudflareBindings,
  validFor: number = JWT_EXPIRATION,
) => {
  return safeSign(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + validFor,
    },
    env.JWT_SECRET,
    'HS256',
  )
}

export const verifyJWT = <
  TSchema extends v.ObjectSchema<
    v.ObjectEntries,
    v.ErrorMessage<v.ObjectIssue> | undefined
  >,
>(
  token: string,
  env: CloudflareBindings,
  schema: TSchema,
) => {
  return safeVerify(token, env.JWT_SECRET, 'HS256').andThen((payload) => {
    const result = v.safeParse(schema, payload)
    if (!result.success) {
      return err(new InvalidJWTPayloadError({ issues: result.issues }))
    }
    return ok(result.output)
  })
}
