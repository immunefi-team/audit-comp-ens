import { err, ok } from 'neverthrow'
import { assert, describe, expect, it } from 'vitest'
import { TaggedError } from '../error-classes'
import {
  asyncRes,
  createIntoResult,
  deserializeResult,
  getFirstOrFallback,
  type SerializedResult,
  serializeResult,
} from '../result-helpers'

describe('createIntoResult', () => {
  it('should wrap successful promise', async () => {
    const DatabaseError = TaggedError('DATABASE_ERROR')
    const intoDbResult = createIntoResult(DatabaseError)

    const promise = Promise.resolve({ id: 1, name: 'John' })
    const result = await intoDbResult(promise)

    assert(result.isOk())
    expect(result.value).toEqual({ id: 1, name: 'John' })
  })

  it('should wrap failing promise with custom error', async () => {
    const DatabaseError = TaggedError('DATABASE_ERROR')
    const intoDbResult = createIntoResult(DatabaseError)

    const promise = Promise.reject(new Error('Connection failed'))
    const result = await intoDbResult(promise)

    assert(result.isErr())
    expect(result.error._tag).toBe('DATABASE_ERROR')
    expect(result.error.message).toBe('Connection failed')
  })

  it('should handle non-Error rejections', async () => {
    const NetworkError = TaggedError('NETWORK_ERROR')
    const intoNetworkResult = createIntoResult(NetworkError)

    const promise = Promise.reject('String error')
    const result = await intoNetworkResult(promise)

    assert(result.isErr())
    expect(result.error._tag).toBe('NETWORK_ERROR')
    expect(result.error.message).toBe('Unknown error')
  })

  it('should work with different error types', async () => {
    const ValidationError = TaggedError('VALIDATION_ERROR')
    const intoValidationResult = createIntoResult(ValidationError)

    const promise = Promise.reject(new Error('Invalid input'))
    const result = await intoValidationResult(promise)

    assert(result.isErr())
    expect(result.error._tag).toBe('VALIDATION_ERROR')
  })
})

describe('asyncRes', () => {
  it('should wrap promise that returns Result', async () => {
    const fetchUser = async (id: string) => {
      if (!id) {
        return err('ID required')
      }
      return ok({ id, name: 'John' })
    }

    const result1 = await asyncRes(fetchUser('123'))
    assert(result1.isOk())
    expect(result1.value).toEqual({ id: '123', name: 'John' })

    const result2 = await asyncRes(fetchUser(''))
    assert(result2.isErr())
    expect(result2.error).toBe('ID required')
  })

  it('should handle async operations', async () => {
    const delayedOperation = async (value: string) => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return value ? ok(value.toUpperCase()) : err('Empty value')
    }

    const result = await asyncRes(delayedOperation('hello'))
    assert(result.isOk())
    expect(result.value).toBe('HELLO')
  })
})

describe('getFirstOrFallback', () => {
  it('should return first item from non-empty array', () => {
    const fallback = err('No items found')
    const getFirst = getFirstOrFallback(fallback)

    const result = getFirst([{ id: 1 }, { id: 2 }])
    assert(result.isOk())
    expect(result.value).toEqual({ id: 1 })
  })

  it('should return fallback for empty array', () => {
    const fallback = err('No items found')
    const getFirst = getFirstOrFallback(fallback)

    const result = getFirst([])
    assert(result.isErr())
    expect(result.error).toBe('No items found')
  })

  it('should use fallback function', () => {
    const getFirst = getFirstOrFallback((items) =>
      err(`Expected items but got ${items.length}`),
    )

    const result = getFirst([])
    assert(result.isErr())
    expect(result.error).toBe('Expected items but got 0')
  })

  it('should work with different data types', () => {
    const fallback = err('No strings found')
    const getFirst = getFirstOrFallback(fallback)

    const result = getFirst(['first', 'second', 'third'])
    assert(result.isOk())
    expect(result.value).toBe('first')
  })
})

describe('serializeResult', () => {
  it('should serialize successful result', () => {
    const result = ok({ id: 1, name: 'John' })
    const serialized = serializeResult(result)

    expect(serialized).toEqual({
      ok: true,
      data: { id: 1, name: 'John' },
    })
  })

  it('should serialize error result', () => {
    const error = { code: 'NOT_FOUND', message: 'User not found' }
    const result = err(error)
    const serialized = serializeResult(result)

    expect(serialized).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'User not found' },
    })
  })

  it('should handle complex data types', () => {
    const complexData = {
      user: { id: 1, name: 'John' },
      posts: [{ id: 1, title: 'Post 1' }],
      metadata: { createdAt: new Date('2023-01-01') },
    }
    const result = ok(complexData)
    const serialized = serializeResult(result)

    expect(serialized).toEqual({
      ok: true,
      data: complexData,
    })
  })
})

describe('deserializeResult', () => {
  it('should deserialize successful result', () => {
    const serialized: SerializedResult<{ id: number }, never> = {
      ok: true,
      data: { id: 1 },
    }
    const result = deserializeResult(serialized)

    assert(result.isOk())
    expect(result.value).toEqual({ id: 1 })
  })

  it('should deserialize error result', () => {
    const serialized: SerializedResult<never, { code: string }> = {
      ok: false,
      error: { code: 'NOT_FOUND' },
    }
    const result = deserializeResult(serialized)

    assert(result.isErr())
    expect(result.error).toEqual({ code: 'NOT_FOUND' })
  })

  it('should round-trip serialize and deserialize', () => {
    const original = ok({ message: 'Hello world' })
    const serialized = serializeResult(original)
    const deserialized = deserializeResult(serialized)

    assert(deserialized.isOk())
    expect(deserialized.value).toEqual(original.value)
  })

  it('should round-trip error serialize and deserialize', () => {
    const original = err({ code: 'VALIDATION_ERROR', message: 'Invalid input' })
    const serialized = serializeResult(original)
    const deserialized = deserializeResult(serialized)

    assert(deserialized.isErr())
    expect(deserialized.error).toEqual(original.error)
  })
})
