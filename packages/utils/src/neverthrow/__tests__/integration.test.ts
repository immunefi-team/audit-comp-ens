import { err, ok } from 'neverthrow'
import { assert, describe, expect, it } from 'vitest'
import {
  createIntoResult,
  fromSync,
  ResultFn,
  TaggedError,
} from '../../neverthrow'

describe('Integration tests', () => {
  // Create some test error classes
  const DatabaseError = TaggedError('DATABASE_ERROR')
  const ValidationError = TaggedError('VALIDATION_ERROR')<{
    field?: string
    value?: unknown
    allowedValues?: unknown[]
  }>
  const NetworkError = TaggedError('NETWORK_ERROR')

  // Create promise wrappers
  const intoDbResult = createIntoResult(DatabaseError)
  const intoNetworkResult = createIntoResult(NetworkError)

  it('should work with complete error handling flow', async () => {
    // Simulate a complex operation that involves multiple steps
    const processUserRegistration = ResultFn(async function* (userData: {
      email: string
      name: string
    }) {
      // Step 1: Validate input
      if (!userData.email || !userData.name) {
        return err(
          new ValidationError({
            message: 'Email and name are required',
            field: !userData.email ? 'email' : 'name',
          }),
        )
      }

      // Step 2: Check if user exists (simulate DB call)
      const existingUser = yield* intoDbResult(
        Promise.resolve(null), // Simulate no existing user
      )

      if (existingUser) {
        return err(
          new ValidationError({
            message: 'User already exists',
            field: 'email',
            value: userData.email,
          }),
        )
      }

      // Step 3: Create user (simulate DB call)
      const newUser = yield* intoDbResult(
        Promise.resolve({
          id: '123',
          email: userData.email,
          name: userData.name,
          createdAt: new Date(),
        }),
      )

      // Step 4: Send welcome email (simulate network call)
      yield* intoNetworkResult(
        Promise.resolve({ messageId: 'msg-123', sent: true }),
      )

      return ok(newUser)
    })

    // Test successful flow
    const result = await processUserRegistration({
      email: 'john@example.com',
      name: 'John Doe',
    })

    assert(result.isOk())
    expect(result.value).toMatchObject({
      id: '123',
      email: 'john@example.com',
      name: 'John Doe',
    })
  })

  it('should handle validation errors', async () => {
    const processUserRegistration = ResultFn(async function* (userData: {
      email: string
      name: string
    }) {
      if (!userData.email) {
        return yield* err(
          new ValidationError({
            message: 'Email is required',
            field: 'email',
          }),
        )
      }

      return ok({ id: '123' })
    })

    const result = await processUserRegistration({
      email: '',
      name: 'John Doe',
    })

    assert(result.isErr())
    expect(result.error._tag).toBe('VALIDATION_ERROR')
    expect(result.error.message).toBe('Email is required')
    expect(result.error.field).toBe('email')
  })

  it('should handle database errors', async () => {
    const processUserRegistration = ResultFn(async function* (_userData: {
      email: string
      name: string
    }) {
      // Simulate database error
      const user = yield* intoDbResult(
        Promise.reject(new Error('Database connection failed')),
      )

      return ok(user)
    })

    const result = await processUserRegistration({
      email: 'john@example.com',
      name: 'John Doe',
    })

    assert(result.isErr())
    expect(result.error._tag).toBe('DATABASE_ERROR')
    expect(result.error.message).toBe('Database connection failed')
  })

  it('should handle network errors', async () => {
    const processUserRegistration = ResultFn(async function* (_userData: {
      email: string
      name: string
    }) {
      // Simulate network error
      yield* intoNetworkResult(Promise.reject(new Error('Network timeout')))

      return ok({ id: '123' })
    })

    const result = await processUserRegistration({
      email: 'john@example.com',
      name: 'John Doe',
    })

    assert(result.isErr())
    expect(result.error._tag).toBe('NETWORK_ERROR')
    expect(result.error.message).toBe('Network timeout')
  })

  it('should work with fromSync for synchronous operations', () => {
    const validateEmail = (email: string) =>
      fromSync(
        () => {
          if (!email.includes('@')) {
            throw new Error('Invalid email format')
          }
          return email.toLowerCase()
        },
        (error) =>
          new ValidationError({
            message:
              error instanceof Error ? error.message : 'Validation failed',
            field: 'email',
          }),
      )

    const result1 = validateEmail('john@example.com')
    assert(result1.isOk())
    expect(result1.value).toBe('john@example.com')

    const result2 = validateEmail('invalid-email')
    assert(result2.isErr())
    expect(result2.error._tag).toBe('VALIDATION_ERROR')
    expect(result2.error.message).toBe('Invalid email format')
  })

  it('should work with mixed sync and async operations', async () => {
    const processData = ResultFn(async function* (data: string) {
      // Sync validation
      const validated = yield* fromSync(
        () => {
          if (!data) throw new Error('Data required')
          return data.trim()
        },
        (error) =>
          new ValidationError({
            message:
              error instanceof Error ? error.message : 'Validation failed',
          }),
      )

      // Async processing
      const processed = yield* intoDbResult(
        Promise.resolve({
          original: validated,
          processed: validated.toUpperCase(),
        }),
      )

      return ok(processed)
    })

    const result1 = await processData('hello world')
    assert(result1.isOk())
    expect(result1.value).toEqual({
      original: 'hello world',
      processed: 'HELLO WORLD',
    })

    const result2 = await processData('')
    assert(result2.isErr())
    expect(result2.error._tag).toBe('VALIDATION_ERROR')
    expect(result2.error.message).toBe('Data required')
  })

  it('should handle complex error scenarios', async () => {
    const complexOperation = ResultFn(async function* (input: {
      userId: string
      action: string
    }) {
      // Multiple validation steps
      if (!input.userId) {
        return err(
          new ValidationError({
            message: 'User ID is required',
            field: 'userId',
          }),
        )
      }

      if (!['read', 'write', 'delete'].includes(input.action)) {
        return err(
          new ValidationError({
            message: 'Invalid action',
            field: 'action',
            allowedValues: ['read', 'write', 'delete'],
          }),
        )
      }

      // Database operation
      const user = yield* intoDbResult(
        input.userId === 'error-user'
          ? Promise.reject(new Error('User not found'))
          : Promise.resolve({ id: input.userId, name: 'John' }),
      )

      // Network operation
      yield* intoNetworkResult(
        input.action === 'delete'
          ? Promise.reject(new Error('Network error'))
          : Promise.resolve({ success: true }),
      )

      return ok({ user, action: input.action, timestamp: new Date() })
    })

    // Test validation error
    const result1 = await complexOperation({ userId: '', action: 'read' })
    assert(result1.isErr())
    expect(result1.error._tag).toBe('VALIDATION_ERROR')

    // Test database error
    const result2 = await complexOperation({
      userId: 'error-user',
      action: 'read',
    })
    assert(result2.isErr())
    expect(result2.error._tag).toBe('DATABASE_ERROR')

    // Test network error
    const result3 = await complexOperation({ userId: '123', action: 'delete' })
    assert(result3.isErr())
    expect(result3.error._tag).toBe('NETWORK_ERROR')

    // Test success
    const result4 = await complexOperation({ userId: '123', action: 'read' })
    assert(result4.isOk())
    expect(result4.value.user.id).toBe('123')
    expect(result4.value.action).toBe('read')
  })
})
