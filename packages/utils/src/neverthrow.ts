/**
 * @fileoverview Neverthrow utilities for functional error handling
 *
 * This module provides utilities for working with neverthrow's Result type,
 * including generator-based error handling, tagged error classes, and
 * promise wrappers.
 *
 * @example
 * ```typescript
 * import { ResultFn, TaggedError, createIntoResult } from '@ens-apps/utils/neverthrow'
 *
 * // Create a tagged error
 * const DatabaseError = TaggedError('DATABASE_ERROR')
 *
 * // Create a promise wrapper
 * const intoDbResult = createIntoResult(DatabaseError)
 *
 * // Use generator-based error handling
 * const processUser = ResultFn(async function* (userId: string) {
 *   const user = yield* intoDbResult(db.query.users.findFirst({ where: eq(users.id, userId) }))
 *   return ok(user)
 * })
 * ```
 */

// Error classes and factories
export {
  DataError,
  type Equals,
  TaggedError,
  YieldableError,
} from './neverthrow/error-classes.js'
// Generator-based error handling
export {
  fromSync,
  type InferErrTypes as GeneratorInferErrTypes,
  type InferOkTypes as GeneratorInferOkTypes,
  ResultFn,
} from './neverthrow/generator-functions.js'

// Promise wrappers and result utilities
export {
  asyncRes,
  createIntoResult,
  deserializeResult,
  fromThrowableV2,
  getFirstOrFallback,
  type InferErrTypes,
  type InferOkTypes,
  type SerializedResult,
  serializeResult,
} from './neverthrow/result-helpers.js'

// Type utilities (re-exported for convenience, but prefer importing from specific files)
export type {
  Equals as TypeEquals,
  InferErrTypes as TypeInferErrTypes,
  InferOkTypes as TypeInferOkTypes,
} from './neverthrow/type-utilities.js'
