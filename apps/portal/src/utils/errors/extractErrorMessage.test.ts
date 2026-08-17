import { describe, expect, it } from 'vitest'
import { extractErrorMessage } from './extractErrorMessage'

describe('extractErrorMessage', () => {
  it('should return fallback for null error', () => {
    const result = extractErrorMessage(null)

    expect(result).toBe('Could not load data.')
  })

  it('should return fallback for undefined error', () => {
    const result = extractErrorMessage(undefined)

    expect(result).toBe('Could not load data.')
  })

  it('should return custom fallback when provided', () => {
    const result = extractErrorMessage(null, 'Custom fallback message')

    expect(result).toBe('Custom fallback message')
  })

  it('should extract message from cause if present', () => {
    const error = {
      message: 'Outer message',
      cause: { message: 'Inner cause message' },
    }

    const result = extractErrorMessage(error)

    expect(result).toBe('Inner cause message')
  })

  it('should fall back to error message if cause has no message', () => {
    const error = {
      message: 'Outer message',
      cause: {},
    }

    const result = extractErrorMessage(error)

    expect(result).toBe('Outer message')
  })

  it('should extract message from error if no cause', () => {
    const error = new Error('Direct error message')

    const result = extractErrorMessage(error)

    expect(result).toBe('Direct error message')
  })

  it('should return fallback if error has no message', () => {
    const error = {}

    const result = extractErrorMessage(error)

    expect(result).toBe('Could not load data.')
  })
})
