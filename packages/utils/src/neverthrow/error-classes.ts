/**
 * biome-ignore-all lint/complexity/noBannedTypes: Needs {} for default values
 * biome-ignore-all lint/suspicious/noExplicitAny: Types are explicitly defined
 * biome-ignore-all lint/suspicious/noConfusingVoidType: Needed to make it optional
 */

import { type Err, err, type Result } from 'neverthrow'

type DefaultErrorBody = {
  message?: string
  cause?: unknown
}

type AnyErrorBody = Record<string & {}, unknown>

export interface ITaggedError {
  readonly _tag: string
}

/**
 * Base error class that can be yielded in generator functions.
 *
 * This class implements the iterator protocol to allow it to be yielded
 * directly in ResultFn generator functions, automatically converting to
 * an error Result.
 *
 * @example
 * ```typescript
 * const processData = ResultFn(function* (data: string) {
 *   if (!data) {
 *     yield* new YieldableError('Data is required')
 *     // This is equivalent to: return err(new YieldableError('Data is required'))
 *   }
 *   return ok(processData(data))
 * })
 * ```
 */
export class YieldableError extends globalThis.Error {
  /**
   * Iterator implementation that yields an error Result.
   * This allows the error to be yielded directly in generator functions.
   */
  *[Symbol.iterator](): Generator<Err<never, this>, Result<never, this>> {
    const result = err(this)

    yield result

    return result
  }
  toErr() {
    return err(this)
  }
  toString(this: Error) {
    return this.message ? `${this.name}: ${this.message}` : this.name
  }
  toJSON() {
    return { ...this }
  }
}

type DataError<Args extends AnyErrorBody = {}> = YieldableError & Readonly<Args>

/**
 * Enhanced error class that can carry additional data and supports JSON serialization.
 *
 * This class extends YieldableError and allows you to attach arbitrary data
 * to error instances. The data is preserved during JSON serialization.
 *
 * @example
 * ```typescript
 * const error = new DataError({
 *   message: 'Validation failed',
 *   field: 'email',
 *   value: 'invalid-email',
 *   cause: originalError
 * })
 *
 * // The error carries all the data
 * console.log(error.field) // 'email'
 * console.log(error.value) // 'invalid-email'
 *
 * // JSON serialization preserves the data
 * const serialized = JSON.stringify(error)
 * // {"message":"Validation failed","field":"email","value":"invalid-email"}
 * ```
 */
export const DataError: new <Args extends AnyErrorBody = {}>(
  args: DefaultErrorBody & { readonly [P in keyof Args]: Args[P] },
) => DataError<Args> = (() =>
  class extends YieldableError {
    constructor(args: any) {
      super(args.message, { cause: args.cause })
      if (args) {
        Object.assign(this, args)
      }
    }
  } as any)()

/**
 * Type utility to check if two types are exactly equal.
 *
 * This is used internally to determine if the DataError constructor
 * should accept arguments or not.
 */
export type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false

type TaggedError<
  Tag extends string,
  Args extends Record<string, unknown> = {},
> = DataError<Args> & { readonly _tag: Tag }

/**
 * Factory function that creates a tagged error class for discriminated unions.
 *
 * This creates error classes that can be used with pattern matching libraries
 * like ts-pattern for type-safe error handling. Each error class gets a unique
 * `_tag` property that can be used for discrimination.
 *
 * @example
 * ```typescript
 * // Create tagged error classes
 * class ValidationError extends TaggedError('VALIDATION_ERROR')<{
 *   message: string
 *   cause?: unknown
 * }> {}
 * class NetworkError extends TaggedError('NETWORK_ERROR')<{
 *   message: string
 *   cause?: unknown
 * }> {}
 *
 * // Use in pattern matching
 * const result = await fetchData()
 * if (result.isErr()) {
 *   match(result.error)
 *     .with({ _tag: 'VALIDATION_ERROR' }, (error) => {
 *       console.log('Validation failed:', error.message)
 *     })
 *     .with({ _tag: 'NETWORK_ERROR' }, (error) => {
 *       console.log('Network error:', error.message)
 *     })
 *     .exhaustive()
 * }
 * ```
 *
 * @param tag - Unique string identifier for this error type
 * @returns Error class constructor with the specified tag
 */
export const TaggedError = <Tag extends string>(
  tag: Tag,
): (new <TArgs extends AnyErrorBody = {}>(
  args: DefaultErrorBody & {
    readonly [TKey in keyof TArgs as TKey extends '_tag'
      ? never
      : TKey]: TArgs[TKey]
  },
) => TaggedError<Tag, TArgs>) => {
  class Base extends DataError<{}> implements ITaggedError {
    readonly _tag = tag
  }
  ;(Base.prototype as any).name = tag
  return Base as any
}
