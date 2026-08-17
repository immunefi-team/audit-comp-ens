import {
  type Err,
  err,
  ok,
  type Result,
  type ResultAsync,
  safeTry,
} from 'neverthrow'

/**
 * Type utilities for inferring Result types from generator functions
 */
export type InferOkTypes<R> = R extends Result<infer T, unknown> ? T : never
export type InferErrTypes<R> = R extends Result<unknown, infer E> ? E : never

/**
 * Wraps a generator function to return a Result or ResultAsync.
 *
 * This function enables generator-based error handling with neverthrow, allowing
 * you to use `yield*` to unwrap Results and propagate errors automatically.
 *
 * @example
 * ```typescript
 * const processUser = ResultFn(async function* (userId: string) {
 *   const user = yield* getUserById(userId) // Unwraps Result<User, Error>
 *   const profile = yield* getUserProfile(user.id) // Unwraps Result<Profile, Error>
 *   return ok({ user, profile }) // Return final result
 * })
 *
 * // Usage
 * const result = await processUser('user-123')
 * if (result.isOk()) {
 *   console.log(result.value.user.name)
 * }
 * ```
 *
 * @param body - Generator function that yields Results and returns a final Result
 * @returns Function that returns a Result or ResultAsync
 */
export function ResultFn<T, E, Args extends unknown[]>(
  body: (...args: Args) => Generator<Err<never, E>, Result<T, E>, never>,
): (...args: Args) => Result<T, E>
export function ResultFn<
  YieldErr extends Err<never, unknown>,
  GeneratorReturnResult extends Result<unknown, unknown>,
  Args extends unknown[],
>(
  body: (...args: Args) => Generator<YieldErr, GeneratorReturnResult, never>,
): (
  ...args: Args
) => Result<
  InferOkTypes<GeneratorReturnResult>,
  InferErrTypes<YieldErr> | InferErrTypes<GeneratorReturnResult>
>

export function ResultFn<T, E, Args extends unknown[]>(
  body: (...args: Args) => AsyncGenerator<Err<never, E>, Result<T, E>, never>,
): (...args: Args) => ResultAsync<T, E>
export function ResultFn<
  YieldErr extends Err<never, unknown>,
  GeneratorReturnResult extends Result<unknown, unknown>,
  Args extends unknown[],
>(
  body: (
    ...args: Args
  ) => AsyncGenerator<YieldErr, GeneratorReturnResult, never>,
): (
  ...args: Args
) => ResultAsync<
  InferOkTypes<GeneratorReturnResult>,
  InferErrTypes<YieldErr> | InferErrTypes<GeneratorReturnResult>
>

export function ResultFn<T, E, Args extends unknown[]>(
  body:
    | ((...args: Args) => Generator<Err<never, E>, Result<T, E>, never>)
    | ((...args: Args) => AsyncGenerator<Err<never, E>, Result<T, E>, never>),
): (...args: Args) => Result<T, E> | ResultAsync<T, E> {
  // biome-ignore lint/suspicious/noExplicitAny: Typescript is having issues with it being able to be both async and sync generator
  return (...args: Args) => safeTry(() => body(...args) as any)
}

/**
 * Wraps a synchronous function that might throw into a Result.
 *
 * @example
 * ```typescript
 * const parseJson = (json: string) => fromSync(
 *   () => JSON.parse(json),
 *   (error) => new ValidationError({ message: 'Invalid JSON', cause: error })
 * )
 *
 * const result = parseJson('{"valid": true}')
 * if (result.isOk()) {
 *   console.log(result.value.valid) // true
 * }
 * ```
 *
 * @param body - Function that might throw
 * @param errorFn - Function to convert thrown errors to your error type
 * @returns Result containing the return value or error
 */
export function fromSync<T, E>(
  body: () => T,
  errorFn: (e: unknown) => E,
): Result<T, E> {
  try {
    return ok(body())
  } catch (e) {
    return err(errorFn(e))
  }
}
