import { describe, expect, it } from 'vitest'
import { getLinkValidationIssues } from './validation'

describe('getLinkValidationIssues', () => {
  it('rejects link titles that collide with reserved text record keys', () => {
    expect(
      getLinkValidationIssues([{ name: 'url', url: 'https://example.com' }]),
    ).toContainEqual({
      field: 'name',
      index: 0,
      message: 'Choose a different name (reserved key)',
    })
  })
})
