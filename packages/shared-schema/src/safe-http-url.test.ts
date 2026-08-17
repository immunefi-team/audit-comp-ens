import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { isSafeHttpUrl, safeHttpUrlSchema } from './safe-http-url'

describe('safe-http-url', () => {
  it('allows http and https URLs', () => {
    expect(isSafeHttpUrl('https://ens.domains')).toBe(true)
    expect(isSafeHttpUrl('http://example.com/path')).toBe(true)
  })

  it('rejects dangerous and non-http URL schemes', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(
      false,
    )
    expect(isSafeHttpUrl('mailto:test@example.com')).toBe(false)
  })

  it('validates with the valibot schema', () => {
    expect(
      v.safeParse(safeHttpUrlSchema(), 'https://ens.domains').success,
    ).toBe(true)
    expect(
      v.safeParse(safeHttpUrlSchema(), 'javascript:alert(1)').success,
    ).toBe(false)
  })
})
