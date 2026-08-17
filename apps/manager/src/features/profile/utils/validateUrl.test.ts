import { describe, expect, it } from 'vitest'
import { validateEmail, validateUrl } from './validateUrl'

describe('validateUrl', () => {
  it('should return undefined for empty values', () => {
    expect(validateUrl(undefined)).toBeUndefined()
    expect(validateUrl('')).toBeUndefined()
    expect(validateUrl('  ')).toBeUndefined()
  })

  it('should accept valid https URLs', () => {
    expect(validateUrl('https://example.com')).toBeUndefined()
    expect(validateUrl('https://ens.domains/about')).toBeUndefined()
    expect(validateUrl('https://sub.domain.co.uk/path?q=1')).toBeUndefined()
  })

  it('should accept valid http URLs', () => {
    expect(validateUrl('http://example.com')).toBeUndefined()
  })

  it('should reject non-http URL schemes', () => {
    expect(validateUrl('javascript:alert(1)')).toBeDefined()
    expect(
      validateUrl('data:text/html,<script>alert(1)</script>'),
    ).toBeDefined()
    expect(validateUrl('vbscript:msgbox("xss")')).toBeDefined()
    expect(validateUrl('file:///etc/passwd')).toBeDefined()
  })

  it('should reject strings without a protocol', () => {
    expect(validateUrl('example.com')).toBeDefined()
    expect(validateUrl('www.example.com')).toBeDefined()
  })

  it('should reject random text', () => {
    expect(validateUrl('not a url')).toBeDefined()
    expect(validateUrl('hello')).toBeDefined()
  })

  it('should reject partial URLs', () => {
    expect(validateUrl('https://')).toBeDefined()
    expect(validateUrl('://')).toBeDefined()
  })
})

describe('validateEmail', () => {
  it('should return undefined for empty values', () => {
    expect(validateEmail(undefined)).toBeUndefined()
    expect(validateEmail('')).toBeUndefined()
    expect(validateEmail('  ')).toBeUndefined()
  })

  it('should accept valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBeUndefined()
    expect(validateEmail('name@ens.domains')).toBeUndefined()
    expect(validateEmail('first.last@sub.domain.com')).toBeUndefined()
  })

  it('should reject emails without @', () => {
    expect(validateEmail('userexample.com')).toBeDefined()
  })

  it('should reject emails without domain', () => {
    expect(validateEmail('user@')).toBeDefined()
  })

  it('should reject random text', () => {
    expect(validateEmail('not-an-email')).toBeDefined()
    expect(validateEmail('hello world')).toBeDefined()
  })
})
