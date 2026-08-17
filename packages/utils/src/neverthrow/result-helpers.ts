import { err, fromPromise, ok, type Result, ResultAsync } from 'neverthrow'
import type { YieldableError } from './error-classes.js'

/**
 * Type utilities for inferring Result types
 */
export type InferOkTypes<R> =
  R extends Result<infer T, unknown>
    ? T
    : R extends ResultAsync<infer T, unknown>
      ? T
      : never

export type InferErrTypes<R> =
  R extends Result<unknown, infer E>
    ? E
    : R extends ResultAsync<unknown, infer E>
      ? E
      : never

/**
 * Creates a typed promise wrapper that converts errors to Result.
 *
 * This factory function eliminates boilerplate when creating `intoResult` helpers
 * for different domains (database, HTTP, etc.). It automatically converts promise
 * rejections to your custom error type.
 *
 * @example
 * ```typescript
 * // Create a database error class
 * class DatabaseError extends TaggedError('DATABASE_ERROR')<{
 *   message: string
 *   cause?: unknown
 * }> {}
 *
 * // Create the wrapper
 * const intoDbResult = createIntoResult(DatabaseError)
 *
 * // Use it
 * const result = await intoDbResult(db.query.users.findFirst(...))
 * if (result.isErr()) {
 *   console.log(result.error._tag) // 'DATABASE_ERROR'
 * }
 * ```
 *
 * @param ErrorClass - Constructor for your error type
 * @returns Function that wraps promises and converts errors
 */
export const createIntoResult = <E extends YieldableError>(
  ErrorClass: new (args: { message: string; cause?: unknown }) => E,
) => {
  return <T>(promise: PromiseLike<T>): ResultAsync<T, E> => {
    return fromPromise(
      promise,
      (err) =>
        new ErrorClass({
          message: err instanceof Error ? err.message : 'Unknown error',
          cause: err,
        }),
    )
  }
}

/**
 * Wraps a promise that returns a Result into a ResultAsync.
 *
 * This is useful when you have a function that returns a Promise<Result<T, E>>
 * and you want to flatten it to ResultAsync<T, E>.
 *
 * @example
 * ```typescript
 * const fetchUser = async (id: string): Promise<Result<User, Error>> => {
 *   // ... implementation
 * }
 *
 * const result = await asyncRes(fetchUser('123'))
 * // result is ResultAsync<User, Error>
 * ```
 *
 * @param promise - Promise that resolves to a Result
 * @returns ResultAsync with the same types
 */
export function asyncRes<T, E>(promise: Promise<Result<T, E>>) {
  return new ResultAsync<T, E>(promise)
}

/**
 * Retrieves the first item from an array or returns a fallback result.
 *
 * This utility is useful for database queries where you expect at most one result
 * but want to handle the "not found" case gracefully.
 *
 * @example
 * ```typescript
 * const users = await db.query.users.findMany({ where: eq(users.email, email) })
 * const user = getFirstOrFallback(
 *   () => error({ code: 'USER_NOT_FOUND', message: 'User not found' })
 * )(users)
 *
 * if (user.isErr()) {
 *   console.log(user.error.code) // 'USER_NOT_FOUND'
 * } else {
 *   console.log(user.value.name) // User object
 * }
 * ```
 *
 * @param fallback - Result to return if array is empty, or function that creates the fallback
 * @returns Function that takes an array and returns first item or fallback
 */
export function getFirstOrFallback<
  TData,
  TFallback extends Result<TData, unknown>,
>(fallback: TFallback | ((data: TData[]) => TFallback)) {
  return (array: TData[]) => {
    const item = array.at(0)
    if (!item) {
      return typeof fallback === 'function' ? fallback(array) : fallback
    }

    return ok(item)
  }
}

/**
 * Type for serialized Result objects.
 *
 * This is useful for API responses where you need to serialize Results
 * to JSON and then deserialize them back to Results.
 */
export type SerializedResult<TData, TError> =
  | {
      ok: true
      data: TData
    }
  | {
      ok: false
      error: TError
    }

/**
 * Serializes a Result to a plain object for JSON transmission.
 *
 * @example
 * ```typescript
 * const result = ok({ id: 1, name: 'John' })
 * const serialized = serializeResult(result)
 * // { ok: true, data: { id: 1, name: 'John' } }
 *
 * const errorResult = err({ code: 'NOT_FOUND', message: 'User not found' })
 * const serializedError = serializeResult(errorResult)
 * // { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } }
 * ```
 *
 * @param result - Result to serialize
 * @returns Plain object representation
 */
export function serializeResult<TData, TError>(
  result: Result<TData, TError>,
): SerializedResult<TData, TError> {
  return result.isOk()
    ? { ok: true as const, data: result.value }
    : { ok: false as const, error: result.error }
}

/**
 * Deserializes a plain object back to a Result.
 *
 * @example
 * ```typescript
 * const serialized = { ok: true, data: { id: 1, name: 'John' } }
 * const result = deserializeResult(serialized)
 * // Result<{ id: 1, name: 'John' }, never>
 *
 * const serializedError = { ok: false, error: { code: 'NOT_FOUND', message: 'User not found' } }
 * const errorResult = deserializeResult(serializedError)
 * // Result<never, { code: 'NOT_FOUND', message: 'User not found' }>
 * ```
 *
 * @param serialized - Serialized result object
 * @returns Result object
 */
export function deserializeResult<TData, TError>(
  serialized: SerializedResult<TData, TError>,
) {
  return serialized.ok ? ok(serialized.data) : err(serialized.error)
}

/**
 * Improved version of fromThrowable that handles functions with generics better
 * @param fn - Function to wrap
 * @param errorFn - Function to convert errors to your error type
 * @returns Function that wraps the function and converts errors to your error type
 */
export function fromThrowableV2<A extends readonly unknown[], R, E>(
  fn: (...args: A) => R,
  errorFn?: (err: unknown) => E,
): (...args: A) => Result<R, E> {
  return (...args) => {
    try {
      return ok(fn(...args))
    } catch (error) {
      return err(errorFn ? errorFn(error) : (error as E))
    }
  }
}
