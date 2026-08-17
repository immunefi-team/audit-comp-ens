import { describe, expect, it } from 'vitest'
import { escapeUnicode } from './escapeUnicode'

describe('escapeUnicode', () => {
  it('should leave ASCII characters unchanged', () => {
    expect(escapeUnicode('test')).toBe('test')
    expect(escapeUnicode('vitalik')).toBe('vitalik')
  })

  it('should escape unicode characters', () => {
    const result = escapeUnicode('café')
    expect(result).toContain('{')
    expect(result).toContain('}')
  })

  it('should escape emoji', () => {
    const result = escapeUnicode('💩')
    expect(result).toContain('{')
    expect(result).toContain('1F4A9') // Unicode code point for 💩
  })

  it('should escape mixed ASCII and unicode', () => {
    const result = escapeUnicode('hello💩world')
    expect(result).toContain('hello')
    expect(result).toContain('world')
    expect(result).toContain('{1F4A9}')
  })

  it('should handle empty string', () => {
    expect(escapeUnicode('')).toBe('')
  })

  it('should escape Chinese characters', () => {
    const result = escapeUnicode('中文')
    expect(result).toContain('{')
    expect(result).toContain('}')
    // Should not contain the original Chinese characters
    expect(result).not.toContain('中')
    expect(result).not.toContain('文')
  })

  it('should escape Cyrillic characters', () => {
    const result = escapeUnicode('привет')
    expect(result).toContain('{')
    expect(result).toContain('}')
  })

  it('should handle domain names with unicode', () => {
    const result = escapeUnicode('münchen.eth')
    expect(result).toContain('.eth')
    expect(result).toContain('{')
  })

  it('should escape characters above ASCII range (> 0x7F)', () => {
    // Character code 0x80 (128) is beyond ASCII
    const result = escapeUnicode(String.fromCharCode(0x80))
    expect(result).toBe('{80}')
  })

  it('should preserve ASCII punctuation', () => {
    expect(escapeUnicode('test.eth')).toBe('test.eth')
    expect(escapeUnicode('a-b-c')).toBe('a-b-c')
  })
})
