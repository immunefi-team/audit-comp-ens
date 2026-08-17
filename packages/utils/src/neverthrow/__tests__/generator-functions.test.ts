import { err, fromPromise, ok } from 'neverthrow'
import { assert, describe, expect, it } from 'vitest'
import { fromSync, ResultFn } from '../generator-functions'

describe('ResultFn', () => {
  it('should work with sync generator', () => {
    // biome-ignore lint/correctness/useYield: Test code
    const processData = ResultFn(function* (data: string) {
      if (!data) {
        return err('Data is required')
      }
      return ok(data.toUpperCase())
    })

    const result1 = processData('hello')
    assert(result1.isOk())
    expect(result1.value).toBe('HELLO')

    const result2 = processData('')
    assert(result2.isErr())
    expect(result2.error).toBe('Data is required')
  })

  it('should work with async generator', async () => {
    const fetchAndProcess = ResultFn(async function* (id: string) {
      if (!id) {
        return err('ID is required')
      }

      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 10))

      return ok({ id, processed: true })
    })

    const result1 = await fetchAndProcess('123')
    assert(result1.isOk())
    expect(result1.value).toEqual({ id: '123', processed: true })

    const result2 = await fetchAndProcess('')
    assert(result2.isErr())
    expect(result2.error).toBe('ID is required')
  })

  it('should handle multiple yield operations', () => {
    const processUser = ResultFn(function* (userId: string) {
      if (!userId) {
        return err('User ID required')
      }

      const user = yield* ok({ id: userId, name: 'John' })
      const profile = yield* ok({ userId: user.id, email: 'john@example.com' })

      return ok({ user, profile })
    })

    const result = processUser('123')
    assert(result.isOk())
    expect(result.value).toEqual({
      user: { id: '123', name: 'John' },
      profile: { userId: '123', email: 'john@example.com' },
    })
  })

  it('should propagate errors through yields', () => {
    const processWithError = ResultFn(function* (shouldFail: boolean) {
      if (shouldFail) {
        return err('Initial error')
      }

      yield* ok('success')
      const processed = yield* err('Processing failed')

      return ok(processed)
    })

    const result1 = processWithError(true)
    assert(result1.isErr())
    expect(result1.error).toBe('Initial error')

    const result2 = processWithError(false)
    assert(result2.isErr())
    expect(result2.error).toBe('Processing failed')
  })

  it('should work with complex async operations', async () => {
    const fetchUserData = ResultFn(async function* (userId: string) {
      if (!userId) {
        return err('User ID is required')
      }

      // Simulate multiple async operations
      const userResult = fromPromise(
        new Promise<{ id: string; name: string }>((resolve) =>
          setTimeout(() => resolve({ id: userId, name: 'John' }), 10),
        ),
        (error) => err(error),
      )
      const user = yield* userResult

      const postsResult = fromPromise(
        new Promise<{ id: number; title: string }[]>((resolve) =>
          setTimeout(() => resolve([{ id: 1, title: 'Post 1' }]), 10),
        ),
        (error) => err(error),
      )
      const posts = yield* postsResult

      return ok({ user, posts })
    })

    const result = await fetchUserData('123')
    assert(result.isOk())
    expect(result.value).toEqual({
      user: { id: '123', name: 'John' },
      posts: [{ id: 1, title: 'Post 1' }],
    })
  })
})

describe('fromSync', () => {
  it('should wrap successful synchronous function', () => {
    const parseJson = fromSync(
      () => JSON.parse('{"valid": true}'),
      (error) => `Parse error: ${error}`,
    )

    assert(parseJson.isOk())
    expect(parseJson.value).toEqual({ valid: true })
  })

  it('should wrap failing synchronous function', () => {
    const parseJson = fromSync(
      () => JSON.parse('invalid json'),
      (error) => `Parse error: ${error}`,
    )

    assert(parseJson.isErr())
    expect(parseJson.error).toContain('Parse error:')
  })

  it('should handle custom error transformation', () => {
    const riskyOperation = fromSync(
      () => {
        throw new Error('Something went wrong')
      },
      (error) => ({
        type: 'OPERATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      }),
    )

    assert(riskyOperation.isErr())
    expect(riskyOperation.error).toMatchObject({
      type: 'OPERATION_ERROR',
      message: 'Something went wrong',
    })
    expect(typeof riskyOperation.error.timestamp).toBe('number')
  })

  it('should handle non-Error exceptions', () => {
    const riskyOperation = fromSync(
      () => {
        throw 'String error'
      },
      (error) => `Caught: ${error}`,
    )

    assert(riskyOperation.isErr())
    expect(riskyOperation.error).toBe('Caught: String error')
  })
})
