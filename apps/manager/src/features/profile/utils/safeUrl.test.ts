import { describe, expect, it } from 'vitest'
import {
  isSafeHttpUrl,
  isSafeImageSrc,
  isSafeRecordHref,
  safeHttpHref,
  safeImageSrc,
  safeRecordHref,
} from './safeUrl'

describe('safeUrl helpers', () => {
  it('accepts http and https for generic web URLs', () => {
    expect(isSafeHttpUrl('https://example.com')).toBe(true)
    expect(isSafeHttpUrl('http://example.com')).toBe(true)
    expect(safeHttpHref('https://example.com/path')).toBe(
      'https://example.com/path',
    )
  })

  it('rejects javascript:, data:, and non-http schemes for generic web URLs', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(
      false,
    )
    expect(isSafeHttpUrl('mailto:foo@example.com')).toBe(false)
    expect(safeHttpHref('javascript:alert(1)')).toBeUndefined()
  })

  it('allows contact and decentralized protocols only for record hrefs', () => {
    expect(isSafeRecordHref('mailto:foo@example.com')).toBe(true)
    expect(isSafeRecordHref('tel:+123456')).toBe(true)
    expect(isSafeRecordHref('ipfs://bafyexample')).toBe(true)
    expect(isSafeRecordHref('ar://example')).toBe(true)
    expect(safeRecordHref('mailto:a@b.c')).toBe('mailto:a@b.c')
  })

  it('rejects javascript: and data: for record hrefs', () => {
    expect(isSafeRecordHref('javascript:alert(1)')).toBe(false)
    expect(isSafeRecordHref('data:image/svg+xml,<svg></svg>')).toBe(false)
    expect(safeRecordHref('javascript:void(0)')).toBeUndefined()
  })

  it('uses http-only URLs for image sources', () => {
    expect(isSafeImageSrc('https://example.com/a.png')).toBe(true)
    expect(isSafeImageSrc('data:image/png;base64,abc')).toBe(false)
    expect(safeImageSrc('javascript:alert(1)')).toBeUndefined()
  })

  it('handles whitespace and empty values', () => {
    expect(isSafeHttpUrl('  https://x.com  ')).toBe(true)
    expect(safeHttpHref('   ')).toBeUndefined()
    expect(safeRecordHref('')).toBeUndefined()
  })
})
