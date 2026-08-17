import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import {
  addEmailChannelBodySchema,
  verifyEmailChannelBodySchema,
} from './email.js'

describe('addEmailChannelBodySchema', () => {
  it('accepts a valid email', () => {
    const result = v.safeParse(addEmailChannelBodySchema, {
      email: 'user@example.com',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.output.email).toBe('user@example.com')
    }
  })

  it('rejects null body', () => {
    const result = v.safeParse(addEmailChannelBodySchema, null)
    expect(result.success).toBe(false)
  })

  it('rejects missing email', () => {
    const result = v.safeParse(addEmailChannelBodySchema, {})
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = v.safeParse(addEmailChannelBodySchema, {
      email: 'not-email',
    })
    expect(result.success).toBe(false)
  })
})

describe('verifyEmailChannelBodySchema', () => {
  it('rejects empty token', () => {
    const result = v.safeParse(verifyEmailChannelBodySchema, { token: '' })
    expect(result.success).toBe(false)
  })

  it('rejects null body', () => {
    const result = v.safeParse(verifyEmailChannelBodySchema, null)
    expect(result.success).toBe(false)
  })
})
