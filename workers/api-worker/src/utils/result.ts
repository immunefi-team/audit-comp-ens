import { err, fromPromise, ok, type Result, ResultAsync } from 'neverthrow'

const AppErrorSymbol = Symbol('AppError')

export type GenericError = {
  code: string
  message: string
  [AppErrorSymbol]?: true
}

export function rawError<const T extends GenericError>(error: T) {
  error[AppErrorSymbol] = true
  return error
}

export function error<const T extends GenericError>(error: T) {
  error[AppErrorSymbol] = true
  return err(error)
}

export const isAppError = <T extends GenericError>(
  error: unknown,
): error is T => {
  return typeof error === 'object' && error !== null && 'code' in error
}

export function createIntoError<const TCode extends string>(code: TCode) {
  return (_error: unknown) => {
    const error =
      _error instanceof Error
        ? _error
        : new Error('Unknown error', {
            cause: _error,
          })

    return rawError({
      code,
      message: error.message as string & {},
      error,
    })
  }
}

export function createIntoResult<TData, TError extends GenericError>(
  intoError: (error: unknown) => TError,
) {
  return (promise: Promise<TData>) => {
    return fromPromise(promise, intoError)
  }
}

/**
 * Retrieves the first item from an array or returns a fallback result.
 *
 * If the array is empty, the fallback will be returned directly.
 * If the array is not empty, the first item will be returned.
 *
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
