import { describe, expect, it } from 'vitest'
import { getGeneralUrlErrorMessage } from './fields'

describe('general URL validation', () => {
  it('validates custom link URL values', () => {
    expect(getGeneralUrlErrorMessage('')).toBeUndefined()
    expect(getGeneralUrlErrorMessage('https://example.com')).toBeUndefined()
    expect(getGeneralUrlErrorMessage('www.example.com')).toBe(
      'Enter a valid URL (e.g. https://example.com)',
    )
    expect(getGeneralUrlErrorMessage('hello')).toBe(
      'Enter a valid URL (e.g. https://example.com)',
    )
  })
})
