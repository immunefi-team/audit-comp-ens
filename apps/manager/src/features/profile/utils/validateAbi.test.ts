import { describe, expect, it } from 'vitest'
import { parseAbiRecord, validateAbi } from './validateAbi'

describe('validateAbi', () => {
  it('should return undefined for empty values', () => {
    expect(validateAbi(undefined)).toBeUndefined()
    expect(validateAbi('')).toBeUndefined()
    expect(validateAbi('  ')).toBeUndefined()
  })

  it('should accept JSON arrays', () => {
    expect(
      validateAbi('[{"type":"function","name":"addr","inputs":[]}]'),
    ).toBeUndefined()
  })

  it('should reject invalid JSON', () => {
    expect(validateAbi('not json')).toBe('ABI must be valid JSON')
  })

  it('should reject JSON values that are not arrays', () => {
    expect(validateAbi('{"type":"function"}')).toBe('ABI must be a JSON array')
  })
})

describe('parseAbiRecord', () => {
  it('should parse valid ABI JSON arrays', () => {
    const result = parseAbiRecord('[{"type":"function"}]')

    expect(result).toEqual({
      success: true,
      data: [{ type: 'function' }],
    })
  })

  it('should parse empty values as null ABI data', () => {
    expect(parseAbiRecord('')).toEqual({ success: true, data: null })
  })
})
