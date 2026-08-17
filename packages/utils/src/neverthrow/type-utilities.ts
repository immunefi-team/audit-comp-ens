import type { Result, ResultAsync } from 'neverthrow'

/**
 * Extracts the success type from a Result or ResultAsync.
 *
 * This utility type is useful for inferring the return type of functions
 * that return Results, especially when working with ResultFn generators.
 *
 * @example
 * ```typescript
 * const getUser = (): Result<User, Error> => { ... }
 * type UserType = InferOkTypes<ReturnType<typeof getUser>> // User
 *
 * const fetchUser = (): ResultAsync<User, Error> => { ... }
 * type UserTypeAsync = InferOkTypes<ReturnType<typeof fetchUser>> // User
 * ```
 */
export type InferOkTypes<R> =
  R extends Result<infer T, unknown>
    ? T
    : R extends ResultAsync<infer T, unknown>
      ? T
      : never

/**
 * Extracts the error type from a Result or ResultAsync.
 *
 * This utility type is useful for inferring the error type of functions
 * that return Results, especially when working with ResultFn generators.
 *
 * @example
 * ```typescript
 * const getUser = (): Result<User, DatabaseError> => { ... }
 * type ErrorType = InferErrTypes<ReturnType<typeof getUser>> // DatabaseError
 *
 * const fetchUser = (): ResultAsync<User, NetworkError> => { ... }
 * type ErrorTypeAsync = InferErrTypes<ReturnType<typeof fetchUser>> // NetworkError
 * ```
 */
export type InferErrTypes<R> =
  R extends Result<unknown, infer E>
    ? E
    : R extends ResultAsync<unknown, infer E>
      ? E
      : never

/**
 * Checks if two types are exactly equal.
 *
 * This is a utility type that performs a deep equality check between two types.
 * It's primarily used internally by the DataError class to determine whether
 * constructor arguments should be required or optional.
 *
 * @example
 * ```typescript
 * type Test1 = Equals<string, string> // true
 * type Test2 = Equals<string, number> // false
 * type Test3 = Equals<{ a: string }, { a: string }> // true
 * type Test4 = Equals<{ a: string }, { a: number }> // false
 * ```
 */
export type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false
