import { TaggedError } from '@ens-apps/utils/neverthrow'
import { fromAsyncThrowable, fromThrowable } from 'neverthrow'
import { parseSiweMessage, verifySiweMessage } from 'viem/siwe'

class SiweParseError extends TaggedError('SIWE_PARSE_ERROR')<{
  message: string
  cause?: unknown
}> {}

class SiweVerifyError extends TaggedError('SIWE_VERIFY_ERROR')<{
  message: string
  cause?: unknown
}> {}

export const safeParseSiweMessage = fromThrowable(
  parseSiweMessage,
  (err) =>
    new SiweParseError({
      message: err instanceof Error ? err.message : 'SIWE parse failed',
      cause: err,
    }),
)

export const safeVerifySiweMessage = fromAsyncThrowable(
  verifySiweMessage,
  (err) =>
    new SiweVerifyError({
      message: err instanceof Error ? err.message : 'SIWE verification failed',
      cause: err,
    }),
)
